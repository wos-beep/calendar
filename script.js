/**
 * ホワサバ・イベント登録ツール
 * script.js v1.1.1
 */

const CONFIG = {
    VERSION: "1.1.1",
    STORAGE_KEY: "ws_event_collector_data"
};

// ==========================================
// 1. Data Management Class
// ==========================================
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
        if (!this.data.version) this.data.version = "1.0.0";
        
        // v1.0.0 から v1.1.x への変換
        if (this.data.version.startsWith("1.0")) {
            console.log("Migrating data to latest structure...");
            this.data.events = this.data.events.map(ev => {
                const start = new Date(ev.start);
                const end = new Date(ev.end);
                return {
                    id: ev.id || crypto.randomUUID(),
                    name: ev.name || ev.type || "名称不明", // ev.nameが空なら旧typeを当てる
                    category: ev.category || ev.type || "未分類",
                    start: ev.start,
                    end: ev.end,
                    occurrence: ev.occurrence || {
                        frequency_type: "once",
                        interval: 1,
                        start_day: start.getUTCDay(),
                        duration_hours: Math.round((end - start) / 3600000)
                    }
                };
            });
            this.data.version = CONFIG.VERSION;
            this.save();
        }
    }
}

// ==========================================
// 2. UI Application Class
// ==========================================
class App {
    constructor(manager) {
        this.manager = manager;
        this.editingId = null;
        this.init();
    }

    init() {
        // Form Submission
        document.getElementById('event-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSave();
        });

        // JSON Export
        document.getElementById('export-btn').addEventListener('click', () => {
            const blob = new Blob([JSON.stringify(this.manager.data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ws_events_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
        });

        // JSON Import
        document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
        document.getElementById('import-file').addEventListener('change', (e) => this.handleImport(e));

        this.render();
    }

    // --- Actions ---

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

        const eventData = {
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
        };

        if (this.editingId) {
            // Update Existing
            const index = this.manager.data.events.findIndex(e => e.id === this.editingId);
            if (index !== -1) {
                this.manager.data.events[index] = { id: this.editingId, ...eventData };
                alert("変更を確定しました。");
            }
        } else {
            // Add New
            this.manager.data.events.push({ id: crypto.randomUUID(), ...eventData });
        }

        this.manager.save();
        this.resetForm();
        this.render();
    }

    handleEdit(id) {
        const ev = this.manager.data.events.find(e => e.id === id);
        if (!ev) return;

        this.editingId = id;
        
        // フォームへ復元
        document.getElementById('event-name').value = ev.name || '';
        document.getElementById('event-type').value = ev.category || '';
        document.getElementById('event-start').value = ev.start;
        document.getElementById('event-end').value = ev.end;
        document.getElementById('event-freq').value = ev.occurrence.frequency_type;
        document.getElementById('event-interval').value = ev.occurrence.interval;

        // UI状態変更
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.textContent = "変更を確定する (更新)";
        submitBtn.classList.replace('bg-blue-600', 'bg-yellow-600');
        submitBtn.classList.replace('hover:bg-blue-700', 'hover:bg-yellow-700');
        
        document.getElementById('form-title').textContent = "イベント情報の編集";
        document.getElementById('form-section').classList.replace('border-blue-600', 'border-yellow-600');

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    handleDelete(id) {
        if (confirm("このイベントデータを削除しますか？")) {
            this.manager.data.events = this.manager.data.events.filter(e => e.id !== id);
            this.manager.save();
            this.render();
        }
    }

    handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target.result);
                this.manager.data = json;
                this.manager.migrate();
                this.manager.save();
                this.render();
                alert("インポートが完了しました。");
            } catch (err) { alert("パースエラー: " + err.message); }
        };
        reader.readAsText(file);
    }

    // --- UI Rendering ---

    resetForm() {
        this.editingId = null;
        document.getElementById('event-form').reset();
        
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.textContent = "この内容で登録する";
        submitBtn.classList.replace('bg-yellow-600', 'bg-blue-600');
        submitBtn.classList.replace('hover:bg-yellow-700', 'hover:bg-blue-700');
        
        document.getElementById('form-title').textContent = "新規イベントの登録 (UTC基準)";
        document.getElementById('form-section').classList.replace('border-yellow-600', 'border-blue-600');
    }

    render() {
        const tbody = document.getElementById('event-list-body');
        tbody.innerHTML = '';

        const sorted = [...this.manager.data.events].sort((a, b) => new Date(a.start) - new Date(b.start));

        sorted.forEach(ev => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-gray-700 hover:bg-gray-750 transition";
            
            const freqLabel = ev.occurrence.frequency_type === 'once' ? '単発' : `${ev.occurrence.interval}週毎`;
            
            tr.innerHTML = `
                <td class="p-3 text-xs text-gray-400 font-mono">
                    ${(ev.start || '').replace('T', ' ')}<br>
                    ${(ev.end || '').replace('T', ' ')}
                </td>
                <td class="p-3">
                    <div class="font-bold text-gray-100">${ev.name || '名称未設定'}</div>
                    <div class="text-xs text-blue-400 font-mono">#${ev.category || '未分類'}</div>
                </td>
                <td class="p-3 text-xs">
                    <span class="px-2 py-0.5 rounded bg-gray-900 border border-gray-700 text-gray-300">${freqLabel}</span>
                </td>
                <td class="p-3 text-right space-x-2">
                    <button onclick="app.handleEdit('${ev.id}')" class="text-yellow-500 hover:text-yellow-400 font-bold transition">編集</button>
                    <button onclick="app.handleDelete('${ev.id}')" class="text-red-500 hover:text-red-400 transition">削除</button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}

// Entry Point
const manager = new DataManager();
const app = new App(manager);
