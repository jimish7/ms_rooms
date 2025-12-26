<?php
require_once __DIR__ . '/util.php';
function graph_token() {
    $tokenCache = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'tmp' . DIRECTORY_SEPARATOR . 'token.json';
    if (file_exists($tokenCache)) {
        $c = json_decode(file_get_contents($tokenCache), true);
        if (isset($c['access_token']) && isset($c['expires_on'])) {
            if (time() < intval($c['expires_on']) - 60) return $c['access_token'];
        }
    }
    $tenant = env_value('AZURE_TENANT_ID');
    $client = env_value('AZURE_CLIENT_ID');
    $secret = env_value('AZURE_CLIENT_SECRET');
    $url = 'https://login.microsoftonline.com/' . $tenant . '/oauth2/v2.0/token';
    $body = http_build_query([
        'client_id' => $client,
        'client_secret' => $secret,
        'scope' => 'https://graph.microsoft.com/.default',
        'grant_type' => 'client_credentials'
    ]);
    $ch = curl_init($url);
    $caf = env_value('CURL_CAINFO');
    $opts = [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => ['Content-Type: application/x-www-form-urlencoded']
    ];
    if ($caf && file_exists($caf)) {
        $opts[CURLOPT_CAINFO] = $caf;
    }
    curl_setopt_array($ch, $opts);
    $res = curl_exec($ch);
    if ($res === false) json_out(['error' => 'token_error', 'detail' => curl_error($ch)], 500);
    $j = json_decode($res, true);
    if (!isset($j['access_token'])) json_out(['error' => 'token_invalid', 'data' => $j], 500);
    $j['expires_on'] = isset($j['expires_in']) ? time() + intval($j['expires_in']) : time() + 3000;
    $dir = dirname($tokenCache);
    if (!is_dir($dir)) mkdir($dir, 0777, true);
    file_put_contents($tokenCache, json_encode($j));
    return $j['access_token'];
}
function graph_get($path, $params = [], $headers = []) {
    $t = graph_token();
    $url = 'https://graph.microsoft.com/v1.0' . $path;
    if (!empty($params)) $url .= '?' . http_build_query($params);
    $ch = curl_init($url);
    $caf = env_value('CURL_CAINFO');
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $t,
            'Accept: application/json'
        ]
    ];
    if (!empty($headers)) {
        foreach ($headers as $h) {
            $opts[CURLOPT_HTTPHEADER][] = $h;
        }
    }
    if ($caf && file_exists($caf)) {
        $opts[CURLOPT_CAINFO] = $caf;
    }
    curl_setopt_array($ch, $opts);
    $res = curl_exec($ch);
    if ($res === false) json_out(['error' => 'graph_get_error'], 500);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $j = json_decode($res, true);
    if ($status >= 400) json_out(['error' => 'graph_get_status', 'status' => $status, 'data' => $j], $status);
    return $j;
}
function graph_post($path, $body = []) {
    $t = graph_token();
    $url = 'https://graph.microsoft.com/v1.0' . $path;
    $ch = curl_init($url);
    $caf = env_value('CURL_CAINFO');
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => [
            'Authorization: Bearer ' . $t,
            'Content-Type: application/json',
            'Accept: application/json'
        ],
        CURLOPT_POSTFIELDS => json_encode($body)
    ];
    if ($caf && file_exists($caf)) {
        $opts[CURLOPT_CAINFO] = $caf;
    }
    curl_setopt_array($ch, $opts);
    $res = curl_exec($ch);
    if ($res === false) json_out(['error' => 'graph_post_error'], 500);
    $status = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $j = json_decode($res, true);
    if ($status >= 400) json_out(['error' => 'graph_post_status', 'status' => $status, 'data' => $j], $status);
    return $j;
}
function list_rooms() {
    $j = graph_get('/places/microsoft.graph.room', ['$top' => 200]);
    return isset($j['value']) ? $j['value'] : [];
}
function room_calendar_view($roomEmail, $startIso, $endIso, $tz = 'India Standard Time') {
    $j = graph_get('/users/' . rawurlencode($roomEmail) . '/calendarView', [
        'startDateTime' => $startIso,
        'endDateTime' => $endIso
    ], ['Prefer: outlook.timezone="' . $tz . '"']);
    return isset($j['value']) ? $j['value'] : [];
}
function book_room($roomEmail, $subject, $startIso, $endIso, $tz = 'UTC') {
    $body = [
        'subject' => $subject,
        'start' => ['dateTime' => $startIso, 'timeZone' => $tz],
        'end' => ['dateTime' => $endIso, 'timeZone' => $tz],
        'isAllDay' => false,
        'showAs' => 'busy',
        'allowNewTimeProposals' => false
    ];
    return graph_post('/users/' . rawurlencode($roomEmail) . '/events', $body);
}
