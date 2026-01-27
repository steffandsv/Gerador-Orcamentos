<?php
// Load credentials
$host = 'srv466.hstgr.io';
$dbname = 'u225637494_fiomb';
$user = 'u225637494_fiomb';
$pass = '20SKDMasx';

if (!$host) {
    die("Database configuration missing. Please create env.php or set environment variables.");
}

try {
    $pdo = new PDO("mysql:host=$host;dbname=$dbname;charset=utf8", $user, $pass);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
} catch (PDOException $e) {
    die("Connection failed: " . $e->getMessage());
}
