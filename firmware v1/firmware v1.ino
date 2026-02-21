#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiUdp.h>
#include <NTPClient.h>
#include <SoftwareSerial.h>
#include <ArduinoJson.h>

// === Function Declarations ===
void connectToWiFi();
void setupWebServer();
void handleRoot();
void handleSubmit();
void handle404();
String getFormattedDateTime();
String formatCustomDate(String customDate);
void initializePrinter();
void printReceipt();
void printServerInfo();
void setInverse(bool enable);
void printLine(String line);
void advancePaper(int lines);
void printWrappedUpsideDown(String text);
// Cloud print queue
void pollPrintJobs();
void printJobList(String title, JsonArray items);
void printJobMessage(String message);
void markJobDone(String jobId, String status);

// === WiFi Configuration ===
const char* ssid     = "Your WIFI name";
const char* password = "Your WIFI password";

// === Supabase Cloud Print Queue ===
// Fill these in from the Scribe app Settings → Printer → View credentials
const char* supabaseUrl = "https://YOUR_PROJECT_ID.supabase.co";
const char* printerId   = "YOUR_PRINTER_ID";
const char* apiKey      = "YOUR_API_KEY";

const unsigned long POLL_INTERVAL_MS = 10000; // Poll every 10 seconds
unsigned long lastPollTime = 0;

// === Time Configuration ===
const long utcOffsetInSeconds = 0; // UTC offset in seconds (0 for UTC, 3600 for UTC+1, etc.)
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", utcOffsetInSeconds, 60000);

// === Web Server ===
ESP8266WebServer server(80);

// === Printer Setup ===
SoftwareSerial printer(D4, D3); // Use D4 (TX, GPIO2), D3 (RX, GPIO0)
const int maxCharsPerLine = 32;

// === Storage for form data (local web UI) ===
struct Receipt {
  String message;
  String timestamp;
  bool hasData;
};

Receipt currentReceipt = {"", "", false};

void setup() {
  Serial.begin(115200);
  Serial.println("\n=== Thermal Printer Server Starting ===");

  // Initialize printer
  initializePrinter();

  // Connect to WiFi
  connectToWiFi();

  // Initialize time client
  timeClient.begin();
  Serial.println("Time client initialized");

  // Setup web server routes
  setupWebServer();

  // Start the server
  server.begin();
  Serial.println("Web server started");

  // Print server info
  printServerInfo();

  Serial.println("=== Setup Complete ===");
}

void loop() {
  // Handle local web server requests
  server.handleClient();

  // Update time client
  timeClient.update();

  // Print any receipt queued via the local web UI
  if (currentReceipt.hasData) {
    printReceipt();
    currentReceipt.hasData = false;
  }

  // Poll Supabase cloud queue for print jobs submitted via the app
  unsigned long now = millis();
  if (WiFi.status() == WL_CONNECTED && now - lastPollTime >= POLL_INTERVAL_MS) {
    lastPollTime = now;
    pollPrintJobs();
  }

  delay(10);
}

// === WiFi Connection ===
void connectToWiFi() {
  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);

  WiFi.begin(ssid, password);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(1000);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println();
    Serial.println("WiFi connected successfully!");
    Serial.print("IP address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println();
    Serial.println("Failed to connect to WiFi");
  }
}

// === Web Server Setup ===
void setupWebServer() {
  server.on("/", HTTP_GET, handleRoot);
  server.on("/submit", HTTP_POST, handleSubmit);
  server.on("/submit", HTTP_GET, handleSubmit);
  server.onNotFound(handle404);
}

// === Web Server Handlers ===
void handleRoot() {
  String html = R"rawliteral(
<!DOCTYPE html>
<html lang="en" class="bg-gray-50 text-gray-900">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Life Receipt</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js"></script>
  <script defer>
    function handleInput(el) {
      const counter = document.getElementById('char-counter');
      const remaining = 200 - el.value.length;
      counter.textContent = `${remaining} characters left`;
      counter.classList.toggle('text-red-500', remaining <= 20);
    }
    function handleSubmit(e) {
      e.preventDefault();
      const formData = new FormData(e.target);
      fetch('/submit', {
        method: 'POST',
        body: formData
      }).then(() => {
        const form = document.getElementById('receipt-form');
        const message = document.getElementById('thank-you');
        form.classList.add('hidden');
        message.classList.remove('hidden');
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
        });
      });
    }
    function handleKeyPress(e) {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        document.getElementById('receipt-form').dispatchEvent(new Event('submit'));
      }
    }
  </script>
</head>
<body class="flex flex-col min-h-screen justify-between items-center py-12 px-4 font-sans">
  <main class="w-full max-w-md text-center">
    <h1 class="text-3xl font-semibold mb-10 text-gray-900 tracking-tight">Life Receipt:</h1>
    <form id="receipt-form" onsubmit="handleSubmit(event)" action="/submit" method="post" class="bg-white shadow-2xl rounded-3xl p-8 space-y-6 border border-gray-100">
      <textarea
        name="message"
        maxlength="200"
        oninput="handleInput(this)"
        onkeypress="handleKeyPress(event)"
        placeholder="Type your receipt…"
        class="w-full p-4 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-transparent resize-none text-gray-800 placeholder-gray-400"
        rows="4"
        required
        autofocus
      ></textarea>
      <div id="char-counter" class="text-sm text-gray-500 text-right">200 characters left</div>
      <button type="submit" class="w-full bg-gray-900 hover:bg-gray-800 text-white py-3 rounded-xl font-medium transition-all duration-200 hover:scale-[1.02] hover:shadow-lg">
        Send
      </button>
    </form>
    <div id="thank-you" class="hidden text-gray-700 font-semibold text-xl mt-8 animate-fade-in">
      🎉 Receipt submitted. You did it!
    </div>
  </main>
  <footer class="text-sm text-gray-400 mt-16">
    Designed with love by <a href="https://urbancircles.club" target="_blank" class="text-gray-500 hover:text-gray-700 transition-colors duration-200 underline decoration-gray-300 hover:decoration-gray-500 underline-offset-2">Peter / Urban Circles</a>
  </footer>
  <style>
    @keyframes fade-in {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .animate-fade-in {
      animation: fade-in 0.6s ease-out forwards;
    }
  </style>
</body>
</html>
)rawliteral";

  server.send(200, "text/html", html);
}

void handleSubmit() {
  if (server.hasArg("message")) {
    currentReceipt.message = server.arg("message");

    if (server.hasArg("date")) {
      String customDate = server.arg("date");
      currentReceipt.timestamp = formatCustomDate(customDate);
      Serial.println("Using custom date: " + customDate);
    } else {
      currentReceipt.timestamp = getFormattedDateTime();
      Serial.println("Using current date");
    }

    currentReceipt.hasData = true;

    Serial.println("=== New Receipt Received ===");
    Serial.println("Message: " + currentReceipt.message);
    Serial.println("Time: " + currentReceipt.timestamp);
    Serial.println("============================");

    server.send(200, "text/plain", "Receipt received and will be printed!");
  } else {
    server.send(400, "text/plain", "Missing message parameter");
  }
}

void handle404() {
  server.send(404, "text/plain", "Page not found");
}

// === Cloud Print Queue Polling ===

void pollPrintJobs() {
  WiFiClientSecure client;
  client.setInsecure(); // Skip certificate verification (sufficient for home use)

  HTTPClient http;
  String url = String(supabaseUrl)
    + "/functions/v1/printer-jobs?printer_id=" + printerId
    + "&api_key=" + apiKey;

  http.begin(client, url);
  http.setTimeout(8000);
  int code = http.GET();

  if (code != 200) {
    Serial.println("Poll failed, HTTP " + String(code));
    http.end();
    return;
  }

  String payload = http.getString();
  http.end();

  DynamicJsonDocument doc(4096);
  if (deserializeJson(doc, payload) != DeserializationError::Ok) {
    Serial.println("JSON parse error");
    return;
  }

  if (doc["job"].isNull()) {
    return; // No pending jobs
  }

  String jobId = doc["job"]["id"].as<String>();
  String type  = doc["job"]["type"].as<String>();
  JsonObject content = doc["job"]["content"];

  Serial.println("=== Cloud print job received ===");
  Serial.println("Job ID: " + jobId);
  Serial.println("Type: " + type);

  if (type == "list") {
    String title    = content["title"] | "List";
    JsonArray items = content["items"];
    printJobList(title, items);
  } else if (type == "message") {
    String message = content["message"] | "";
    printJobMessage(message);
  }

  markJobDone(jobId, "done");
  Serial.println("=== Job complete ===");
}

void printJobList(String title, JsonArray items) {
  // Print each item first (they appear at the bottom after 180° rotation)
  for (int i = items.size() - 1; i >= 0; i--) {
    printWrappedUpsideDown(items[i].as<String>());
  }

  // Print title header last (appears at top after rotation)
  setInverse(true);
  printLine(title);
  setInverse(false);

  advancePaper(2);
}

void printJobMessage(String message) {
  printWrappedUpsideDown(message);

  setInverse(true);
  printLine(getFormattedDateTime());
  setInverse(false);

  advancePaper(2);
}

void markJobDone(String jobId, String status) {
  WiFiClientSecure client;
  client.setInsecure();

  HTTPClient http;
  String url = String(supabaseUrl)
    + "/functions/v1/printer-jobs?api_key=" + apiKey;

  http.begin(client, url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(8000);

  DynamicJsonDocument body(256);
  body["job_id"] = jobId;
  body["status"] = status;

  String bodyStr;
  serializeJson(body, bodyStr);

  int code = http.POST(bodyStr);
  if (code != 200) {
    Serial.println("markJobDone failed, HTTP " + String(code));
  }

  http.end();
}

// === Time Utilities ===
String getFormattedDateTime() {
  timeClient.update();

  unsigned long epochTime = timeClient.getEpochTime();
  time_t rawTime = epochTime;
  struct tm * timeInfo = gmtime(&rawTime);

  String dayNames[]   = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
  String monthNames[] = {"Jan", "Feb", "Mar", "Apr", "May", "Jun",
                         "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};

  String formatted = dayNames[timeInfo->tm_wday] + ", ";
  formatted += String(timeInfo->tm_mday < 10 ? "0" : "") + String(timeInfo->tm_mday) + " ";
  formatted += monthNames[timeInfo->tm_mon] + " ";
  formatted += String(timeInfo->tm_year + 1900);

  return formatted;
}

String formatCustomDate(String customDate) {
  String dayNames[]   = {"Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"};
  String monthNames[] = {"Jan", "Feb", "Mar", "Apr", "May", "Jun",
                         "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"};

  int day = 0, month = 0, year = 0;

  if (customDate.indexOf('-') != -1) {
    int firstDash  = customDate.indexOf('-');
    int secondDash = customDate.indexOf('-', firstDash + 1);
    if (firstDash != -1 && secondDash != -1) {
      year  = customDate.substring(0, firstDash).toInt();
      month = customDate.substring(firstDash + 1, secondDash).toInt();
      day   = customDate.substring(secondDash + 1).toInt();
    }
  } else if (customDate.indexOf('/') != -1) {
    int firstSlash  = customDate.indexOf('/');
    int secondSlash = customDate.indexOf('/', firstSlash + 1);
    if (firstSlash != -1 && secondSlash != -1) {
      day   = customDate.substring(0, firstSlash).toInt();
      month = customDate.substring(firstSlash + 1, secondSlash).toInt();
      year  = customDate.substring(secondSlash + 1).toInt();
    }
  }

  if (day < 1 || day > 31 || month < 1 || month > 12 || year < 1900 || year > 2100) {
    Serial.println("Invalid date format, using current date");
    return getFormattedDateTime();
  }

  String formatted = "   , "; // Day-of-week skipped for custom dates
  formatted += String(day < 10 ? "0" : "") + String(day) + " ";
  formatted += monthNames[month - 1] + " ";
  formatted += String(year);

  return formatted;
}

// === Printer Functions ===
void initializePrinter() {
  printer.begin(9600);
  delay(500);

  printer.write(0x1B); printer.write('@');    // ESC @ — initialise
  delay(50);

  printer.write(0x1B); printer.write('7');    // ESC 7 — set heat config
  printer.write(15);  // Heating dots (max 15)
  printer.write(150); // Heating time
  printer.write(250); // Heating interval

  printer.write(0x1B); printer.write('{'); printer.write(0x01); // ESC { 1 — 180° rotation

  Serial.println("Printer initialized");
}

void printReceipt() {
  Serial.println("Printing receipt...");

  printWrappedUpsideDown(currentReceipt.message);

  setInverse(true);
  printLine(currentReceipt.timestamp);
  setInverse(false);

  advancePaper(2);

  Serial.println("Receipt printed successfully");
}

void printServerInfo() {
  Serial.println("=== Server Info ===");
  Serial.print("Local IP: ");
  Serial.println(WiFi.localIP());
  Serial.println("==================");

  String serverInfo = "Server started at " + WiFi.localIP().toString();
  printWrappedUpsideDown(serverInfo);

  setInverse(true);
  printLine("PRINTER SERVER READY");
  setInverse(false);

  advancePaper(3);
}

void setInverse(bool enable) {
  printer.write(0x1D); printer.write('B');
  printer.write(enable ? 1 : 0);
}

void printLine(String line) {
  printer.println(line);
}

void advancePaper(int lines) {
  for (int i = 0; i < lines; i++) {
    printer.write(0x0A);
  }
}

void printWrappedUpsideDown(String text) {
  String lines[100];
  int lineCount = 0;

  while (text.length() > 0) {
    if (text.length() <= (unsigned int)maxCharsPerLine) {
      lines[lineCount++] = text;
      break;
    }

    int lastSpace = text.lastIndexOf(' ', maxCharsPerLine);
    if (lastSpace == -1) lastSpace = maxCharsPerLine;

    lines[lineCount++] = text.substring(0, lastSpace);
    text = text.substring(lastSpace);
    text.trim();
  }

  for (int i = lineCount - 1; i >= 0; i--) {
    printLine(lines[i]);
  }
}
