<?php
require_once __DIR__ . '/util.php';
require_once __DIR__ . '/graph.php';
$method = $_SERVER['REQUEST_METHOD'];
$path = isset($_GET['path']) ? $_GET['path'] : '';
if ($path === 'config') {
    $cfg = read_json(dirname(__DIR__) . '/config/app.json', [
        'refreshSeconds' => 60,
        'durations' => [15, 30, 60],
        'theme' => 'dark',
        'pastelColors' => false
    ]);
    json_out($cfg);
}
if ($path === 'rooms') {
    $map = read_json(dirname(__DIR__) . '/config/locations.json', []);
    $local = isset($_GET['local']) && $_GET['local'] === '1';
    if ($local) {
        $out = [];
        foreach ($map as $b) {
            foreach ($b['floors'] as $f) {
                foreach ($f['rooms'] as $r) {
                    $out[] = [
                        'id' => $r['email'],
                        'email' => $r['email'],
                        'name' => $r['alias'],
                        'building' => $b['name'],
                        'floor' => $f['name'],
                        'alias' => $r['alias']
                    ];
                }
            }
        }
        json_out($out);
    }
    $rooms = list_rooms();
    $byEmail = [];
    foreach ($map as $b) {
        foreach ($b['floors'] as $f) {
            foreach ($f['rooms'] as $r) {
                $byEmail[$r['email']] = ['building' => $b['name'], 'floor' => $f['name'], 'alias' => $r['alias']];
            }
        }
    }
    $out = [];
    foreach ($rooms as $room) {
        $email = isset($room['emailAddress']) ? $room['emailAddress'] : '';
        $meta = isset($byEmail[$email]) ? $byEmail[$email] : null;
        $out[] = [
            'id' => $room['id'],
            'email' => $email,
            'name' => $room['displayName'],
            'building' => $meta ? $meta['building'] : null,
            'floor' => $meta ? $meta['floor'] : null,
            'alias' => $meta ? $meta['alias'] : null
        ];
    }
    json_out($out);
}
if ($path === 'calendar' && $method === 'GET') {
    $email = isset($_GET['email']) ? $_GET['email'] : '';
    $start = isset($_GET['start']) ? $_GET['start'] : '';
    $end = isset($_GET['end']) ? $_GET['end'] : '';
    if (!$email || !$start || !$end) json_out(['error' => 'missing_params'], 400);
    $events = room_calendar_view($email, $start, $end);
    json_out($events);
}
if ($path === 'book' && $method === 'POST') {
    $data = json_decode(file_get_contents('php://input'), true);
    if (!$data) {
        file_put_contents('debug_log.txt', "Invalid JSON: " . file_get_contents('php://input') . "\n", FILE_APPEND);
        json_out(['error' => 'invalid_json'], 400);
    }
    if (!isset($data['email']) || !isset($data['subject']) || !isset($data['start']) || !isset($data['end'])) {
        file_put_contents('debug_log.txt', "Missing fields: " . print_r($data, true) . "\n", FILE_APPEND);
        json_out(['error' => 'missing_fields'], 400);
    }

    $email = $data['email'];
    $subject = $data['subject'];
    $start = $data['start'];
    $end = $data['end'];
    $tz = isset($data['tz']) ? $data['tz'] : 'UTC';

    // Map common timezones to PHP supported ones if needed
    $tzMap = [
        'India Standard Time' => 'Asia/Kolkata'
    ];
    $phpTz = isset($tzMap[$tz]) ? $tzMap[$tz] : 'UTC';
    
    file_put_contents('debug_log.txt', "Booking Request: Start=$start, End=$end, TZ=$tz, PHPTZ=$phpTz\n", FILE_APPEND);

    // Convert to UTC for conflict check (Graph requires UTC or matching TZ)
    try {
        $dtStart = new DateTime($start, new DateTimeZone($phpTz));
        $dtStart->setTimezone(new DateTimeZone('UTC'));
        $startUtc = $dtStart->format('Y-m-d\TH:i:s\Z');

        $dtEnd = new DateTime($end, new DateTimeZone($phpTz));
        $dtEnd->setTimezone(new DateTimeZone('UTC'));
        $endUtc = $dtEnd->format('Y-m-d\TH:i:s\Z');
    } catch (Exception $e) {
        file_put_contents('debug_log.txt', "Date Parse Error: " . $e->getMessage() . "\n", FILE_APPEND);
        json_out(['error' => 'invalid_date_format', 'detail' => $e->getMessage()], 400);
    }

    // Check conflicts
    // Use the requested TZ for the header so we get response times in that TZ (easier to compare with input)
    // But query using UTC times to be safe.
    $events = room_calendar_view($email, $startUtc, $endUtc, $tz);

    foreach ($events as $ev) {
        // Events are in $tz (e.g. IST) because of the header
        $s = strtotime($ev['start']['dateTime']);
        $e = strtotime($ev['end']['dateTime']);
        
        // Input $start/$end are in $tz (IST)
        $ns = strtotime($start);
        $ne = strtotime($end);

        // Check overlap
        if ($ns < $e && $ne > $s) {
            json_out(['error' => 'conflict', 'debug' => [
                'ev_start' => $ev['start']['dateTime'],
                'ev_end' => $ev['end']['dateTime'],
                'req_start' => $start,
                'req_end' => $end
            ]], 409);
        }
    }
    $created = book_room($email, $subject, $start, $end, $tz);
    json_out($created, 201);
}
if ($path === 'locations' && $method === 'GET') {
    $loc = read_json(dirname(__DIR__) . '/config/locations.json', []);
    json_out($loc);
}
if ($path === 'locations' && $method === 'POST') {
    $key = env_value('ADMIN_KEY');
    $b = bearer();
    if (!$key || !$b || $key !== $b) json_out(['error' => 'unauthorized'], 401);
    $data = json_decode(file_get_contents('php://input'), true);
    write_json(dirname(__DIR__) . '/config/locations.json', $data);
    json_out(['ok' => true]);
}
json_out(['error' => 'not_found'], 404);
