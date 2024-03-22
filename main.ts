import { App, Notice, MarkdownView, Scope, Plugin, PluginSettingTab, Setting } from 'obsidian';

interface HemingwayModePluginSettings {
	enabled: boolean;
}

const HEMINGWAY_MODE_BODY_CLASS = 'hemingway'

const DEFAULT_SETTINGS: HemingwayModePluginSettings = {
	enabled: false
}

export default class HemingwayModePlugin extends Plugin {
	settings: HemingwayModePluginSettings;
	keyMapScope: Scope;

	async onload() {
		this.keyMapScope = new Scope(this.app.scope);
		const nop = () => false;
		const voidKeys = [
			'ArrowLeft', 
			'ArrowRight', 
			'ArrowUp', 
			'ArrowDown',
			'End',
			'Home',
			'PageUp',
			'PageDown',
			'Backspace',
			'Delete',
			'Clear',
			'Cut',
			'EraseEof',
			'Redo',
			'Undo',
		];
		for (const key of voidKeys) {
			this.keyMapScope.register([], key, nop); 
			this.keyMapScope.register(['Meta'], key, nop); 
			this.keyMapScope.register(['Alt'], key, nop); 
			this.keyMapScope.register(['Ctrl'], key, nop); 
			this.keyMapScope.register(['Shift'], key, nop); 
			this.keyMapScope.register(['Mod'], key, nop); 
			this.keyMapScope.register(['Meta', 'Shift'], key, nop); 
			this.keyMapScope.register(['Alt', 'Shift'], key, nop); 
			this.keyMapScope.register(['Ctrl', 'Shift'], key, nop); 
			this.keyMapScope.register(['Shift', 'Shift'], key, nop); 
			this.keyMapScope.register(['Mod', 'Shift'], key, nop); 
		}
		this.keyMapScope.register(['Meta'], 'Z', nop); 

		this.addSettingTab(new HemingwayModeSettingTab(this.app, this));

		this.addCommand({
			id: 'toggle-active',
			name: 'Toggle active',
			callback: async () => {
				this.settings.enabled = !this.settings.enabled;
				await this.saveSettings();
				await this.updateStatus();
			}
		});
	
		await this.loadSettings();
		setTimeout(async () => { await this.updateStatus(); }, 500);
	}

	onunload() {
		// ...
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async updateStatus() {
		if (this.settings.enabled) {
			await this.installHemingwayKeymap();
			await this.setupView();
		}
		else {
			await this.uninstallHemingwayKeymap();
			this.restoreView();
		}
		new Notice(`Hemingway mode ${this.settings.enabled ? 'active' : 'inactive'}`, 2000);
	}

	async installHemingwayKeymap() {		
		this.app.keymap.pushScope(this.keyMapScope);
	}

	async uninstallHemingwayKeymap() {
		this.app.keymap.popScope(this.keyMapScope);
	}

	async setupView() {
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (markdownView) {
			markdownView.editor.setCursor({line: 99999999, ch: 0});
			markdownView.contentEl.addClass(HEMINGWAY_MODE_BODY_CLASS);
			markdownView.contentEl.addEventListener('click', this.mouseEventListener.bind(this));
		}		
	}

	async restoreView() {
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (markdownView) {
			markdownView.contentEl.removeClass(HEMINGWAY_MODE_BODY_CLASS);
			markdownView.contentEl.removeEventListener('click', this.mouseEventListener.bind(this));
		}		
	}

	mouseEventListener(ev: MouseEvent) {
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		markdownView?.editor.focus();
	}
}

class HemingwayModeSettingTab extends PluginSettingTab {
	plugin: HemingwayModePlugin;

	constructor(app: App, plugin: HemingwayModePlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;
		containerEl.empty();
		new Setting(containerEl)
			.setName('Hemingway Mode enabled')
			.setDesc('Prevents any editing, so you can only write ahead.')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enabled)
				.onChange(async (value) => {
					this.plugin.settings.enabled = value;
					await this.plugin.saveSettings();
				})
			);
	}
}
