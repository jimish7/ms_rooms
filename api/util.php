<?php
function env_value($key) {
    static $loaded = null;
    if ($loaded === null) {
        $loaded = [];
        $path = dirname(__DIR__) . DIRECTORY_SEPARATOR . '.env';
        if (file_exists($path)) {
            $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            foreach ($lines as $line) {
                if (strpos($line, '=') !== false) {
                    [$k, $v] = explode('=', $line, 2);
                    $loaded[trim($k)] = trim($v);
                }
            }
        }
    }
    return isset($loaded[$key]) ? $loaded[$key] : getenv($key);
}
function json_out($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}
function read_json($path, $default = []) {
    if (!file_exists($path)) return $default;
    $s = file_get_contents($path);
    $j = json_decode($s, true);
    return is_array($j) ? $j : $default;
}
function write_json($path, $data) {
    $d = dirname($path);
    if (!is_dir($d)) mkdir($d, 0777, true);
    file_put_contents($path, json_encode($data));
}
function bearer() {
    $h = isset($_SERVER['HTTP_AUTHORIZATION']) ? $_SERVER['HTTP_AUTHORIZATION'] : '';
    if (stripos($h, 'Bearer ') === 0) return substr($h, 7);
    return null;
}
