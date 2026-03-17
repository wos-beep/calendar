/**
 * イベント収集ツール Logic
 * script.js v1.0.0
 */

const CONFIG = {
    VERSION: "1.0.0",
    STORAGE_KEY: "ws_event_collector_data"
};

// --- データ管理クラス ---
class DataManager {
    constructor() {
        this.data = this.load();
        this.migrate();
    }

    load() {
        const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
        return raw ? JSON.parse(raw) : { version: CONFIG.VERSION, events: [] };
    }

    save() {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.data));
    }

    migrate() {
        // 将来的なバージョンアップ時にここに処理を追加
        if (this.data.version !== CONFIG.VERSION) {
            console.log(`Migrating from ${this.data.version} to ${CONFIG.VERSION}`);
            this.data.version = CONFIG.VERSION;
            this.save();
        }
    }

    addEvent(event) {
        this.data.events.push({
            id: crypto.randomUUID(),
            ...event
        });
        this.save();
    }

    deleteEvent(id) {
        this.data.events = this.data.events.filter(e => e.id !== id);
        this.save();
    }
}

// --- UI操作クラス ---
class App {
    constructor(manager) {
        this.manager = manager;
        this.initEventListeners();
        this.render();
    }

    initEventListeners() {
        // フォーム送信
        document.getElementById('event-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSave();
        });

        // エクスポート
        document.getElementById('export-btn').addEventListener('click', () => this.handleExport());

        // インポート
        document.getElementById('import-btn').addEventListener('click', () => {
            document.getElementById('import-file').click();
        });
        document.getElementById('import-file').addEventListener('change', (e) => this.handleImport(e));
    }

    handleSave() {
        const name = document.getElementById('event-name').value;
        const type = document.getElementById('event-type').value;
        const start = document.getElementById('event-start').value;
        const end = document.getElementById('event-end').value;

        // 仕様: 日時チェック
        if (new Date(start) >= new Date(end)) {
            alert("エラー: 終了日時は開始日時より後に設定してください。");
            return;
        }

        this.manager.addEvent({ name, type, start, end });
        document.getElementById('event-form').reset();
        this.render();
    }

    handleExport() {
        const blob = new Blob([JSON.stringify(this.manager.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ws_events_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    }

    handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const importedData = JSON.parse(event.target.result);
                if (!importedData.events) throw new Error("無効な形式です");
                
                this.manager.data = importedData;
                this.manager.migrate();
                this.manager.save();
                this.render();
                alert("データのインポートが完了しました。");
            } catch (err) {
                alert("インポートに失敗しました: " + err.message);
            }
        };
        reader.readAsText(file);
    }

    render() {
        const tbody = document.getElementById('event-list-body');
        tbody.innerHTML = '';

        // 日付順にソートして表示
        const sortedEvents = [...this.manager.data.events].sort((a, b) => new Date(a.start) - new Date(b.start));

        sortedEvents.forEach(event => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-gray-700 hover:bg-gray-700 transition";
            tr.innerHTML = `
                <td class="p-2 text-xs text-gray-400">
                    ${event.start.replace('T', ' ')}<br>
                    ${event.end.replace('T', ' ')}
                </td>
                <td class="p-2 font-medium">${event.name}</td>
                <td class="p-2 text-gray-400">${event.type || '-'}</td>
                <td class="p-2 text-right">
                    <button onclick="app.handleDelete('${event.id}')" class="text-red-400 hover:text-red-300">削除</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    handleDelete(id) {
        if (confirm('このイベントを削除しますか？')) {
            this.manager.deleteEvent(id);
            this.render();
        }
    }
}

// 初期化
const manager = new DataManager();
const app = new App(manager);
