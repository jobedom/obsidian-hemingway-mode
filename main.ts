import { App, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, Editor, EditorTransaction } from "obsidian";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { StateField, StateEffect } from "@codemirror/state";

interface HemingwayModePluginSettings {
  enabled: boolean;
  allowBackspace: boolean;
  showToggleNotice: boolean;
  showStatusBar: boolean;
  statusBarText: string;
}

const DEFAULT_SETTINGS: HemingwayModePluginSettings = {
  enabled: false,
  allowBackspace: false,
  showToggleNotice: true,
  showStatusBar: true,
  statusBarText: "Hemingway",
};

// State field to track whether Hemingway mode is active in the editor
const hemingwayModeState = StateField.define<boolean>({
  create: () => false,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(toggleHemingwayMode)) {
        return effect.value;
      }
    }
    return value;
  },
});

const toggleHemingwayMode = StateEffect.define<boolean>();

export default class HemingwayModePlugin extends Plugin {
  settings: HemingwayModePluginSettings;
  statusBar: HTMLElement;

  async onload() {
    await this.loadSettings();

    this.addSettingTab(new HemingwayModeSettingTab(this.app, this));

    this.statusBar = this.addStatusBarItem();
    this.statusBar.addClass("hemingway-mode-status");
    this.statusBar.hide();

    this.addCommand({
      id: "toggle-active",
      name: "Toggle active",
      callback: () => {
        this.settings.enabled = !this.settings.enabled;
        this.saveSettings();
        this.updateStatus();
      },
    });

    this.registerEditorExtension(
      hemingwayModeState.init(() => this.settings.enabled)
    );

    this.registerEditorExtension(
      ViewPlugin.fromClass(
        class {
          view: EditorView;
          settings: HemingwayModePluginSettings;
          plugin: HemingwayModePlugin;

          constructor(view: EditorView) {
            this.view = view;
            // Fix: Use getPlugin() instead of directly accessing plugins
            this.plugin = (app as any).plugins.getPlugin("hemingway-mode") as HemingwayModePlugin;
            this.settings = this.plugin.settings;
            this.updateClass();
          }

          update(update: ViewUpdate) {
            if (update.docChanged || update.selectionSet) {
                const isEnabled = update.state.field(hemingwayModeState);
                if (isEnabled) {
                    // Always move cursor to the end when typing
                    this.view.dispatch({
                        selection: { anchor: this.view.state.doc.length },
                    });
                }
            }

            if (update.transactions.some(tr => tr.effects.some(e => e.is(toggleHemingwayMode)))) {
              this.settings = this.plugin.settings;
              this.updateClass();
            }
          }

          updateClass() {
            if (this.view.state.field(hemingwayModeState)) {
              this.view.dom.addClass("hemingway");
            } else {
              this.view.dom.removeClass("hemingway");
            }
          }
        }
      )
    );

    this.registerDomEvent(document, "keydown", (evt: KeyboardEvent) => {
        const isEnabled = this.settings.enabled;

        if (isEnabled) {
            const forbiddenKeys = [
                "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown",
                "Home", "End", "PageUp", "PageDown",
                "Delete",
            ];

            if (forbiddenKeys.includes(evt.key) || (evt.key === 'z' && (evt.ctrlKey || evt.metaKey))) {
                evt.preventDefault();
                evt.stopPropagation();
            }

            if (evt.key === "Backspace" && !this.settings.allowBackspace) {
                evt.preventDefault();
                evt.stopPropagation();
            }
        }
    }, { capture: true });


    this.updateStatus();
  }

  onunload() {
    this.updateEditor(false);
    this.statusBar.remove();
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  updateStatus(quiet = false) {
    if (this.settings.enabled) {
      if (this.settings.showStatusBar) {
        this.statusBar.setText(this.settings.statusBarText);
        this.statusBar.show();
      }
      this.updateEditor(true);
    } else {
      this.statusBar.hide();
      this.updateEditor(false);
    }

    if (this.settings.showToggleNotice && !quiet) {
      new Notice(`Hemingway mode ${this.settings.enabled ? "active" : "inactive"}`, 2000);
    }
  }

  updateEditor(isEnabled: boolean) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (view && view.editor) {
      const editorView = (view.editor as any).cm as EditorView;
      editorView.dispatch({
        effects: toggleHemingwayMode.of(isEnabled),
      });
    }
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

    new Setting(containerEl)
      .setName("Hemingway mode enabled")
      .setDesc("Prevents any editing, so you can only write ahead.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.enabled).onChange(async (value) => {
          this.plugin.settings.enabled = value;
          await this.plugin.saveSettings();
          this.plugin.updateStatus();
        })
      );

    new Setting(containerEl)
      .setName("Show activation state in status bar")
      .setDesc("Shows in the status bar when the write-only mode is active.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.showStatusBar).onChange(async (value) => {
          this.plugin.settings.showStatusBar = value;
          await this.plugin.saveSettings();
          await this.plugin.updateStatus(true);
          this.display();
        })
      );

    if (this.plugin.settings.showStatusBar) {
      new Setting(containerEl)
        .setName("Text to show in status bar")
        .setDesc("Appears in status bar when the write-only mode is active.")
        .addText((text) =>
          text.setValue(this.plugin.settings.statusBarText).onChange(async (value) => {
            this.plugin.settings.statusBarText = value;
            await this.plugin.saveSettings();
            await this.plugin.updateStatus(true);
          })
        );
    }

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
  }
}
