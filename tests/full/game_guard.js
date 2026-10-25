// Обёртка над tools/game_guard.py (один сторож и для встраивания, и для тестов)
const cp = require('child_process'), path = require('path');
const PY = path.join(__dirname, '..', '..', 'tools', 'game_guard.py');
exports.check = (html, id) => JSON.parse(cp.spawnSync('python3', [PY, '-', id, '--json'], { input: html }).stdout.toString() || '["сторож не запустился"]');
