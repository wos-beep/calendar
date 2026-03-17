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

// constructor と init を修正
class App {
    constructor(manager) {
        this.manager = manager;
        this.editingId = null; // 編集中のIDを保持
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
        const fields = {
            name: document.getElementById('event-name').value,
            category: document.getElementById('event-type').value,
            start: document.getElementById('event-start').value,
            end: document.getElementById('event-end').value,
            freq: document.getElementById('event-freq').value,
            interval: parseInt(document.getElementById('event-interval').value)
        };

        if (new Date(fields.start) >= new Date(fields.end)) {
            alert("エラー: 終了日時は開始日時より後に設定してください。");
            return;
        }

        const occurrence = {
            frequency_type: fields.freq,
            interval: fields.interval,
            start_day: new Date(fields.start).getUTCDay(),
            duration_hours: Math.round((new Date(fields.end) - new Date(fields.start)) / 3600000)
        };

        if (this.editingId) {
            // 【編集モード】既存データの更新
            const index = this.manager.data.events.findIndex(e => e.id === this.editingId);
            if (index !== -1) {
                this.manager.data.events[index] = {
                    ...this.manager.data.events[index],
                    ...fields,
                    occurrence
                };
                this.manager.save();
                this.editingId = null;
                alert("データを更新しました。");
            }
        } else {
            // 【新規モード】
            this.manager.addEvent({ ...fields, occurrence });
        }

        this.resetForm();
        this.render();
    }

    handleEdit(id) {
        const ev = this.manager.data.events.find(e => e.id === id);
        if (!ev) return;

        this.editingId = id;
    
        // フォームに値を復元
        document.getElementById('event-name').value = ev.name;
        document.getElementById('event-type').value = ev.category;
        document.getElementById('event-start').value = ev.start;
        document.getElementById('event-end').value = ev.end;
        document.getElementById('event-freq').value = ev.occurrence.frequency_type;
        document.getElementById('event-interval').value = ev.occurrence.interval;

        // ボタンの見た目を変更
        const submitBtn = document.querySelector('#event-form button[type="submit"]');
        submitBtn.textContent = "変更を保存（更新）";
        submitBtn.classList.replace('bg-blue-600', 'bg-yellow-600');
        submitBtn.classList.replace('hover:bg-blue-700', 'hover:bg-yellow-700');
    
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    resetForm() {
        this.editingId = null;
        document.getElementById('event-form').reset();
        const submitBtn = document.querySelector('#event-form button[type="submit"]');
        submitBtn.textContent = "実績を保存";
        submitBtn.classList.replace('bg-yellow-600', 'bg-blue-600');
        submitBtn.classList.replace('hover:bg-yellow-700', 'hover:bg-blue-700');
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
                <td class="p-2 text-right space-x-2">
                    <button onclick="app.handleEdit('${ev.id}')" class="text-yellow-400 hover:text-yellow-300 text-xs font-bold">編集</button>
                    <button onclick="app.handleDelete('${ev.id}')" class="text-red-400 hover:text-red-300 text-xs">削除</button>
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
