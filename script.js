/**
 * ホワサバ・イベント実績収集ツール
 * script.js v1.1.0
 */

const CONFIG = {
    VERSION: "1.1.0",
    STORAGE_KEY: "ws_event_collector_data"
};

class DataManager {
    constructor() {
        this.data = this.load();
        this.migrate();
    }

    load() {
        const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
        // 初期データ構造
        return raw ? JSON.parse(raw) : { version: CONFIG.VERSION, events: [] };
    }

    save() {
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(this.data));
    }

    migrate() {
        if (!this.data.version) this.data.version = "1.0.0";

        // v1.0.0 -> v1.1.0 へのマイグレーション
        if (this.data.version === "1.0.0") {
            console.log("Migrating from v1.0.0 to v1.1.0...");
            this.data.events = this.data.events.map(event => {
                const start = new Date(event.start);
                const end = new Date(event.end);
                return {
                    id: event.id || crypto.randomUUID(),
                    name: event.name,
                    category: event.type || "未分類",
                    start: event.start,
                    end: event.end,
                    occurrence: {
                        frequency_type: "once",
                        interval: 1,
                        start_day: start.getUTCDay(),
                        duration_hours: Math.round((end - start) / 3600000)
                    }
                };
            });
            this.data.version = "1.1.0";
            this.save();
        }
    }

    addEvent(eventData) {
        const newEvent = {
            id: crypto.randomUUID(),
            ...eventData
        };
        this.data.events.push(newEvent);
        this.save();
    }

    deleteEvent(id) {
        this.data.events = this.data.events.filter(e => e.id !== id);
        this.save();
    }
}

class App {
    constructor(manager) {
        this.manager = manager;
        this.init();
    }

    init() {
        // 保存処理
        document.getElementById('event-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSave();
        });

        // エクスポート
        document.getElementById('export-btn').addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(this.manager.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ws_events_v${this.manager.data.version}_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        });

        // インポート
        document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
        document.getElementById('import-file').addEventListener('change', (e) => this.handleImport(e));

        this.render();
    }

    handleSave() {
        const name = document.getElementById('event-name').value;
        const category = document.getElementById('event-type').value;
        const start = document.getElementById('event-start').value;
        const end = document.getElementById('event-end').value;
        const freq = document.getElementById('event-freq').value;
        const interval = parseInt(document.getElementById('event-interval').value);

        const startDate = new Date(start);
        const endDate = new Date(end);

        if (startDate >= endDate) {
            alert("エラー: 終了日時は開始日時より後に設定してください。");
            return;
        }

        this.manager.addEvent({
            name,
            category,
            start,
            end,
            occurrence: {
                frequency_type: freq,
                interval: interval,
                start_day: startDate.getUTCDay(),
                duration_hours: Math.round((endDate - startDate) / 3600000)
            }
        });

        document.getElementById('event-form').reset();
        this.render();
    }

    handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                this.manager.data = json;
                this.manager.migrate(); // インポート時にもマイグレーションを走らせる
                this.manager.save();
                this.render();
                alert("インポートに成功しました。");
            } catch (err) {
                alert("パースエラー: " + err.message);
            }
        };
        reader.readAsText(file);
    }

    render() {
        const tbody = document.getElementById('event-list-body');
        tbody.innerHTML = '';

        // 開始日時順にソート
        const sorted = [...this.manager.data.events].sort((a, b) => new Date(a.start) - new Date(b.start));

        sorted.forEach(ev => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-gray-700 hover:bg-gray-750 transition";
            
            const freqText = ev.occurrence.frequency_type === 'once' ? '単発' : `${ev.occurrence.interval}週毎`;
            
            tr.innerHTML = `
                <td class="p-2 text-xs text-gray-400">
                    ${ev.start.replace('T', ' ')}<br>
                    ${ev.end.replace('T', ' ')}
                </td>
                <td class="p-2 font-medium">
                    ${ev.name}<br>
                    <span class="text-xs text-blue-400">#${ev.category}</span>
                </td>
                <td class="p-2 text-xs">
                    <span class="px-2 py-1 rounded bg-gray-700">${freqText}</span>
                </td>
                <td class="p-2 text-right">
                    <button onclick="app.handleDelete('${ev.id}')" class="text-red-400 hover:text-red-300 text-xs px-2">削除</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    handleDelete(id) {
        if (confirm("この実績データを削除しますか？")) {
            this.manager.deleteEvent(id);
            this.render();
        }
    }
}

// 実行
const manager = new DataManager();
const app = new App(manager);
