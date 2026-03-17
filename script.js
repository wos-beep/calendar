/**
 * ホワサバ・イベント登録ツール
 * script.js v1.1.2
 */

const CONFIG = {
    VERSION: "1.1.2",
    STORAGE_KEY: "ws_event_collector_data"
};

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
        if (this.data.version.startsWith("1.0") || this.data.version === "1.1.1") {
            console.log("Migrating data to latest structure...");
            this.data.events = this.data.events.map(ev => {
                const start = new Date(ev.start);
                const end = new Date(ev.end);
                return {
                    id: ev.id || crypto.randomUUID(),
                    name: ev.name || ev.type || "名称不明",
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

        // UI Control Listeners
        document.getElementById('event-freq').addEventListener('change', () => this.updateUIState());
        document.getElementById('event-interval-select').addEventListener('change', () => this.updateUIState());

        // JSON IO
        document.getElementById('export-btn').addEventListener('click', () => this.handleExport());
        document.getElementById('import-btn').addEventListener('click', () => document.getElementById('import-file').click());
        document.getElementById('import-file').addEventListener('change', (e) => this.handleImport(e));

        this.updateUIState();
        this.render();
    }

    // --- UI Control ---

    updateUIState() {
        const freq = document.getElementById('event-freq').value;
        const intervalSelect = document.getElementById('event-interval-select');
        const intervalCustom = document.getElementById('event-interval-custom');
        const container = document.getElementById('interval-container');

        if (freq === 'weekly') {
            container.classList.remove('opacity-30', 'pointer-events-none');
            intervalSelect.disabled = false;
            if (intervalSelect.value === 'custom') {
                intervalCustom.classList.remove('hidden');
            } else {
                intervalCustom.classList.add('hidden');
            }
        } else {
            container.classList.add('opacity-30', 'pointer-events-none');
            intervalSelect.disabled = true;
            intervalCustom.classList.add('hidden');
        }
    }

    // --- Actions ---

    handleSave() {
        const name = document.getElementById('event-name').value;
        const category = document.getElementById('event-type').value;
        const start = document.getElementById('event-start').value;
        const end = document.getElementById('event-end').value;
        const freq = document.getElementById('event-freq').value;
        
        // 数値取得のロジック
        const selectVal = document.getElementById('event-interval-select').value;
        const interval = selectVal === 'custom' 
            ? parseInt(document.getElementById('event-interval-custom').value) || 1
            : parseInt(selectVal);

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
            const index = this.manager.data.events.findIndex(e => e.id === this.editingId);
            if (index !== -1) {
                this.manager.data.events[index] = { id: this.editingId, ...eventData };
                alert("変更を確定しました。");
            }
        } else {
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
        
        document.getElementById('event-name').value = ev.name || '';
        document.getElementById('event-type').value = ev.category || '';
        document.getElementById('event-start').value = ev.start;
        document.getElementById('event-end').value = ev.end;
        document.getElementById('event-freq').value = ev.occurrence.frequency_type;

        // 間隔値の復元
        const interval = ev.occurrence.interval;
        if ([1, 2, 4].includes(interval)) {
            document.getElementById('event-interval-select').value = interval;
            document.getElementById('event-interval-custom').value = 1;
        } else {
            document.getElementById('event-interval-select').value = 'custom';
            document.getElementById('event-interval-custom').value = interval;
        }

        const submitBtn = document.getElementById('submit-btn');
        submitBtn.textContent = "変更を確定する (更新)";
        submitBtn.classList.replace('bg-blue-600', 'bg-yellow-600');
        submitBtn.classList.replace('hover:bg-blue-700', 'hover:bg-yellow-700');
        document.getElementById('form-title').textContent = "イベント情報の編集";
        document.getElementById('form-section').classList.replace('border-blue-600', 'border-yellow-600');

        this.updateUIState();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    handleDelete(id) {
        if (confirm("このイベントデータを削除しますか？")) {
            this.manager.data.events = this.manager.data.events.filter(e => e.id !== id);
            this.manager.save();
            this.render();
        }
    }

    handleExport() {
        const blob = new Blob([JSON.stringify(this.manager.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `ws_events_v${this.manager.data.version}_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
    }

    handleImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                this.manager.data = JSON.parse(event.target.result);
                this.manager.migrate();
                this.manager.save();
                this.render();
                alert("インポートが完了しました。");
            } catch (err) { alert("インポートエラー: " + err.message); }
        };
        reader.readAsText(file);
    }

    resetForm() {
        this.editingId = null;
        document.getElementById('event-form').reset();
        const submitBtn = document.getElementById('submit-btn');
        submitBtn.textContent = "この内容で登録する";
        submitBtn.classList.replace('bg-yellow-600', 'bg-blue-600');
        submitBtn.classList.replace('hover:bg-yellow-700', 'hover:bg-blue-700');
        document.getElementById('form-title').textContent = "新規イベントの登録 (UTC基準)";
        document.getElementById('form-section').classList.replace('border-yellow-600', 'border-blue-600');
        this.updateUIState();
    }

    render() {
        const tbody = document.getElementById('event-list-body');
        tbody.innerHTML = '';
        const sorted = [...this.manager.data.events].sort((a, b) => new Date(a.start) - new Date(b.start));

        sorted.forEach(ev => {
            const tr = document.createElement('tr');
            tr.className = "border-b border-gray-700 hover:bg-gray-750 transition-colors";
            const freqLabel = ev.occurrence.frequency_type === 'once' ? '単発' : `${ev.occurrence.interval}週毎`;
            
            tr.innerHTML = `
                <td class="p-3 text-xs text-gray-400 font-mono">
                    ${(ev.start || '').replace('T', ' ')}<br>
                    ${(ev.end || '').replace('T', ' ')}
                </td>
                <td class="p-3">
                    <div class="font-bold text-gray-100">${ev.name}</div>
                    <div class="text-xs text-blue-400 font-mono">#${ev.category}</div>
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

const manager = new DataManager();
const app = new App(manager);
