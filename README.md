# MSRooms - Meeting Room Booking System

MSRooms is a lightweight, responsive, and open-source meeting room booking application that integrates seamlessly with Microsoft 365 (Exchange Online). It provides a real-time timeline view of room availability, allowing users to book slots directly from a touch-friendly interface.

## Features

-   **Visual Timeline**: Interactive horizontal timeline showing room availability (30-minute slots).
-   **Microsoft 365 Integration**: Real-time sync with Outlook/Exchange calendars via Microsoft Graph API.
-   **Touch-Friendly**: Optimized for tablets and wall-mounted displays outside meeting rooms.
-   **Smart Layout**: Automatically adjusts row heights to fit the screen (ideal for 1-4 rooms on a dashboard).
-   **PWA Support**: Installable as a native-like app on Windows, Android, and iOS with offline caching.
-   **Configurable**: Easy customization of colors, themes, refresh rates, and timezones.
-   **Pastel Mode**: Optional distinct pastel colors for booked slots to improve readability.
-   **Soft Loader**: Non-intrusive loading indicators for a smooth user experience.

## Prerequisites

-   **Web Server**: Apache, Nginx, or IIS.
-   **PHP**: Version 7.4 or higher (with `curl` and `json` extensions).
-   **Microsoft 365 Tenant**: Admin access to register an application in Azure AD.

## Installation

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/yourusername/msrooms.git
    cd msrooms
    ```

2.  **Configure Web Server**
    -   Point your web server's document root to the `public/` directory.
    -   Ensure the server can read files in the parent directory (for config and API).

3.  **Azure AD Setup**
    -   Go to [Azure Portal](https://portal.azure.com) > **App registrations**.
    -   New Registration > Name: "AptRooms" > Supported account types: "Accounts in this organizational directory only".
    -   **Certificates & secrets**: Create a new Client Secret. Copy the Value.
    -   **API Permissions**: Add `Microsoft Graph` > `Application permissions`:
        -   `Calendars.ReadWrite` (To read and book rooms)
        -   `Place.Read.All` (To list rooms)
        -   `User.Read.All` (To read organizer details)
    -   **Grant admin consent** for your organization.

4.  **Environment Configuration**
    -   Create a `.env` file in the root directory (same level as `config/` and `public/`).
    -   Add your Azure credentials:
        ```ini
        AZURE_TENANT_ID=your-tenant-id-guid
        AZURE_CLIENT_ID=your-client-id-guid
        AZURE_CLIENT_SECRET=your-client-secret-value
        ```

5.  **Room Configuration**
    -   Edit `config/locations.json` to define your buildings and rooms.
    -   The `email` field must match the room's mailbox email in Microsoft 365.
    ```json
    [
      {
        "name": "Headquarters",
        "floors": [
          {
            "name": "1st Floor",
            "rooms": [
              {
                "alias": "Conference Room A",
                "email": "conf-room-a@yourdomain.com",
                "capacity": 10
              }
            ]
          }
        ]
      }
    ]
    ```

## Customization Guide

### 1. Application Settings (`config/app.json`)
Manage general UI behavior without touching code.
```json
{
  "refreshSeconds": 60,             // How often to fetch new data
  "durations": [15, 30, 45, 60],    // Available booking durations in minutes
  "theme": "dark",                  // "dark" or "light"
  "pastelColors": true              // Enable unique colors for meeting cards    
}
```

### 2. Timezone & Localization (Critical)
By default, the application is configured for **India Standard Time (IST)**. To change this to your local timezone (e.g., EST/New York), you must update both the Backend and Frontend.

**Step A: Backend (`api/index.php` & `api/graph.php`)**
1.  Open `api/index.php`.
2.  Find the `tzMap` array (around line 86) and update/add your timezone:
    ```php
    $tzMap = [
        'India Standard Time' => 'Asia/Kolkata',
        'Eastern Standard Time' => 'America/New_York' // Add yours
    ];
    ```
3.  Open `api/graph.php`.
4.  Find `room_calendar_view` function (around line 102). Change default `$tz`:
    ```php
    function room_calendar_view(..., $tz = 'Eastern Standard Time') { ... }
    ```

**Step B: Frontend (`public/app.js`)**
1.  Open `public/app.js`.
2.  Update the Timezone Constants at the top:
    ```javascript
    const IST_OFFSET = '-05:00'; // Update to your offset (e.g., -05:00 for EST)
    const IST_MINUTES_OFFSET = -300; // Offset in minutes
    ```
3.  Replace all instances of `Asia/Kolkata` with your IANA timezone (e.g., `America/New_York`).
    -   In `getISTDateStr()`
    -   In `fmtIST()`
    -   In `isToday()`
    -   In `openModal()` (multiple occurrences)
    -   In `updateClock()`

### 3. Business Hours
To show a different timeline range (e.g., 8 AM to 6 PM instead of 24 hours):
1.  Open `public/app.js`.
2.  Edit:
    ```javascript
    const BUSINESS_START_HOUR = 8;
    const BUSINESS_END_HOUR = 18;
    ```

### 4. Branding (Logo & Icons)
-   Replace `public/logo.png` with your company logo.
-   Replace `public/favicon.ico`.
-   Update `public/manifest.json` with your app name and theme colors.

## Progressive Web App (PWA)
This project is PWA-ready.
-   **Manifest**: `public/manifest.json` defines the app identity.
-   **Service Worker**: `public/sw.js` caches core assets for offline resilience.
-   **Installation**: Users accessing the site via Chrome/Edge/Safari will see an "Install" option to add it to their home screen or desktop.

## Folder Structure
```
aptrooms/
├── api/                  # Backend PHP logic
│   ├── graph.php         # Microsoft Graph API wrapper
│   ├── index.php         # API entry point & routing
│   └── util.php          # Helpers (Env parser, JSON I/O)
├── config/               # Configuration files
│   ├── app.json          # Frontend settings
│   └── locations.json    # Room definitions
├── public/               # Web root
│   ├── app.js            # Main frontend logic
│   ├── styles.css        # Styling & Dark theme
│   ├── sw.js             # Service Worker
│   └── index.html        # Entry HTML
└── .env                  # Secrets (Not committed)
```

## License
MIT License. Feel free to use and modify for your organization.
