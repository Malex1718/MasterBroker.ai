<?php
class CalendarLogger {
    private $logFile;
    private $userId;

    public function __construct($userId) {
        $this->userId = $userId;
        $this->logFile = __DIR__ . '/logs/calendar_sync_' . date('Y-m') . '.log';
        $this->ensureLogDirectoryExists();
    }

    private function ensureLogDirectoryExists() {
        $logDir = dirname($this->logFile);
        if (!file_exists($logDir)) {
            mkdir($logDir, 0755, true);
        }
    }

    public function info($message, $context = []) {
        $this->log('INFO', $message, $context);
    }

    public function error($message, $context = []) {
        $this->log('ERROR', $message, $context);
    }

    public function warning($message, $context = []) {
        $this->log('WARNING', $message, $context);
    }

    private function log($level, $message, $context = []) {
        $timestamp = date('Y-m-d H:i:s');
        $contextStr = !empty($context) ? json_encode($context) : '';
        $logMessage = sprintf(
            "[%s] [%s] [User: %d] %s %s\n",
            $timestamp,
            $level,
            $this->userId,
            $message,
            $contextStr
        );
        
        file_put_contents($this->logFile, $logMessage, FILE_APPEND);
    }

    public function getRecentLogs($lines = 100) {
        if (!file_exists($this->logFile)) {
            return [];
        }

        $logs = [];
        $file = new SplFileObject($this->logFile, 'r');
        $file->seek(PHP_INT_MAX);
        $lastLine = $file->key();

        $startLine = max(0, $lastLine - $lines);
        $file->seek($startLine);

        while (!$file->eof()) {
            $logs[] = $file->fgets();
        }

        return $logs;
    }

    public function clearLogs() {
        if (file_exists($this->logFile)) {
            file_put_contents($this->logFile, '');
        }
    }
}