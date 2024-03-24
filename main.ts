import {
  App,
  Notice,
  MarkdownView,
  Scope,
  Plugin,
  ColorComponent,
  TextComponent,
  PluginSettingTab,
  Setting,
} from "obsidian";

interface HemingwayModePluginSettings {
  enabled: boolean;
  allowBackspace: boolean;
  showToggleNotice: boolean;
  showTopLineWhenActive: boolean;
  topLineColor: string;
  topLineWidth: number;
}

const HEMINGWAY_MODE_BODY_CLASS = "hemingway";
const DEFAULT_TOP_LINE_COLOR = "#cc0000";

const DEFAULT_SETTINGS: HemingwayModePluginSettings = {
  enabled: false,
  allowBackspace: false,
  showToggleNotice: true,
  showTopLineWhenActive: true,
  topLineColor: DEFAULT_TOP_LINE_COLOR,
  topLineWidth: 3,
};

export default class HemingwayModePlugin extends Plugin {
  settings: HemingwayModePluginSettings;
  keyMapScope: Scope;

  async onload() {
    this.addSettingTab(new HemingwayModeSettingTab(this.app, this));

    this.addCommand({
      id: "toggle-active",
      name: "Toggle active",
      callback: async () => {
        this.settings.enabled = !this.settings.enabled;
        await this.saveSettings();
        await this.updateStatus();
      },
    });

    this.app.workspace.on("active-leaf-change", async () => {
      await this.updateStatus(true);
    });

    await this.loadSettings();
    this.buildKeyMapScope(this.settings.allowBackspace);
  }

  async onunload() {
    if (this.settings.enabled) {
      await this.uninstallHemingwayKeymap();
      await this.restoreView();
    }
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  onExternalSettingsChange() {
    this.updateStatus(true);
  }

  buildKeyMapScope(allowBackspace: boolean) {
    this.keyMapScope = new Scope(this.app.scope);
    const nop = () => false;
    const voidKeys = [
      "ArrowLeft",
      "ArrowRight",
      "ArrowUp",
      "ArrowDown",
      "End",
      "Home",
      "PageUp",
      "PageDown",
      "Delete",
      "Clear",
      "Cut",
      "EraseEof",
      "Redo",
      "Undo",
    ];

    if (!allowBackspace) {
      voidKeys.push("Backspace");
    }

    for (const key of voidKeys) {
      this.keyMapScope.register([], key, nop);
      this.keyMapScope.register(["Meta"], key, nop);
      this.keyMapScope.register(["Alt"], key, nop);
      this.keyMapScope.register(["Ctrl"], key, nop);
      this.keyMapScope.register(["Shift"], key, nop);
      this.keyMapScope.register(["Mod"], key, nop);
      this.keyMapScope.register(["Meta", "Shift"], key, nop);
      this.keyMapScope.register(["Alt", "Shift"], key, nop);
      this.keyMapScope.register(["Ctrl", "Shift"], key, nop);
      this.keyMapScope.register(["Shift", "Shift"], key, nop);
      this.keyMapScope.register(["Mod", "Shift"], key, nop);
    }

    this.keyMapScope.register(["Meta"], "Z", nop);
  }

  async updateStatus(quiet = false) {
    this.buildKeyMapScope(this.settings.allowBackspace);

    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    markdownView?.contentEl.style.setProperty("--hemingway-active-top-line-color", this.settings.topLineColor);
    markdownView?.contentEl.style.setProperty("--hemingway-active-top-line-width", `${this.settings.topLineWidth}px`);

    if (this.settings.enabled) {
      await this.installHemingwayKeymap();
      await this.setupView();
    } else {
      await this.uninstallHemingwayKeymap();
      await this.restoreView();
    }
    if (this.settings.showToggleNotice && !quiet) {
      new Notice(`Hemingway mode ${this.settings.enabled ? "active" : "inactive"}`, 2000);
    }
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
      markdownView.editor?.setCursor({ line: 99999999, ch: 0 });
      markdownView.contentEl.removeClass(HEMINGWAY_MODE_BODY_CLASS);
      if (this.settings.showTopLineWhenActive) {
        markdownView.contentEl.addClass(HEMINGWAY_MODE_BODY_CLASS);
      }
      markdownView.contentEl.addEventListener("click", this.mouseEventListener.bind(this));
    }
  }

  async restoreView() {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (markdownView) {
      markdownView.contentEl.removeClass(HEMINGWAY_MODE_BODY_CLASS);
      markdownView.contentEl.removeEventListener("click", this.mouseEventListener.bind(this));
    }
  }

  mouseEventListener(ev: MouseEvent) {
    const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
    markdownView?.editor?.focus();
  }
}

class HemingwayModeSettingTab extends PluginSettingTab {
  plugin: HemingwayModePlugin;

  constructor(app: App, plugin: HemingwayModePlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Hemingway Mode" });

    containerEl.createEl("h3", { text: "General" });

    new Setting(containerEl)
      .setName("Hemingway Mode enabled")
      .setDesc("Prevents any editing, so you can only write ahead.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
          this.plugin.settings.enabled = value;
          await this.plugin.saveSettings();
          await this.plugin.updateStatus(true);
        })
      );

    new Setting(containerEl)
      .setName("Show notice when toggling status")
      .setDesc("Helps noticing changes between enabled and disabled.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showToggleNotice).onChange(async (value) => {
          this.plugin.settings.showToggleNotice = value;
          await this.plugin.saveSettings();
          await this.plugin.updateStatus(true);
        })
      );

    new Setting(containerEl)
      .setName("Allow using Backspace key even if active")
      .setDesc("Allows deleting text with Backspace. This is useful for lousy typists.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.allowBackspace).onChange(async (value) => {
          this.plugin.settings.allowBackspace = value;
          await this.plugin.saveSettings();
          await this.plugin.updateStatus(true);
        })
      );

    containerEl.createEl("h3", { text: "Appearance" });

    new Setting(containerEl)
      .setName("Show top line when active")
      .setDesc("Shows a colored top line in the editor when Hemingway mode is active.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showTopLineWhenActive).onChange(async (value) => {
          this.plugin.settings.showTopLineWhenActive = value;
          await this.plugin.saveSettings();
          await this.plugin.updateStatus(true);
          this.display();
        })
      );

    if (this.plugin.settings.showTopLineWhenActive) {
      const colorCustomization = new Setting(this.containerEl)
        .setName("Top line color")
        .setDesc("Color of the top line when Hemingway mode is active.");
      const colorPicker = new ColorComponent(colorCustomization.controlEl)
        .setValue(this.plugin.settings.topLineColor)
        .onChange(async (value) => {
          this.plugin.settings.topLineColor = value;
          await this.plugin.saveSettings();
          await this.plugin.updateStatus(true);
        });
      colorCustomization.addButton((button) => {
        button
          .setButtonText("Default")
          .setTooltip("Set color to default")
          .onClick(async () => {
            colorPicker.setValue(DEFAULT_TOP_LINE_COLOR);
            this.plugin.settings.topLineColor = DEFAULT_TOP_LINE_COLOR;
            await this.plugin.saveSettings();
            await this.plugin.updateStatus(true);
          });
      });
      colorCustomization.components.push(colorPicker);

      new Setting(containerEl)
        .setName("Top line width")
        .setDesc("Width of the top line when Hemingway mode is active.")
        .addText((text: TextComponent) => {
          text.inputEl.type = "number";
          text.setPlaceholder("3");
          text.setValue(this.plugin.settings.topLineWidth.toString());
          text.onChange(async (value: string) => {
            this.plugin.settings.topLineWidth = parseInt(value);
            await this.plugin.saveSettings();
            await this.plugin.updateStatus(true);
          });
        });
    }

    containerEl.createEl("hr");

    containerEl.createEl("div", {
      text: "Enjoying this plugin? Want more features?",
    });
    const button = containerEl.createEl("div");
    const a = document.createElement("a");
    const img = document.createElement("img");
    img.src = "https://storage.ko-fi.com/cdn/kofi2.png?v=3";
    img.setAttr("height", 36);
    img.style.marginTop = "15px";
    img.style.border = "0";
    img.style.height = "36px";
    a.setAttribute("href", "https://ko-fi.com/jobedom");
    a.appendChild(img);
    button.appendChild(a);
  }
}
