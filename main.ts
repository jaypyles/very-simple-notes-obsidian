import {
	App,
	Modal,
	Notice,
	Plugin,
	PluginSettingTab,
	Setting,
} from "obsidian";

interface PluginSettings {
	url: string;
}

const DEFAULT_SETTINGS: PluginSettings = {
	url: "url",
};

interface Note {
	name: string | null;
	tags: string[];
	content: string | null;
	group: string | null;
}

const extractContentAfterTags = (content: string) => {
	const regex = /---\n#[^\n]*\n\n([\s\S]*)/;
	const matches = content.match(regex);

	if (matches) {
		return matches[1].trim();
	}

	return content;
};

export default class NoteUploaderPlugin extends Plugin {
	settings: PluginSettings;
	uploadNote = async (note: Note) => {
		await fetch(this.settings.url, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify(note),
		})
			.then(async (res) => {
				return res.status;
			})
			.then((res) => {
				if (res === 200) {
					new Notice("Note successfully uploaded.");
				} else {
					new Notice("Something went wrong when uploading!");
				}
			});
	};

	async onload() {
		await this.loadSettings();

		this.addRibbonIcon(
			"upload",
			"Upload to Very Simple Notes",
			async (evt: MouseEvent) => {
				const activeFile = this.app.workspace.getActiveFile();
				const filename = activeFile ? activeFile.name : null;
				let content = null;
				let tags: string[] = [];

				if (activeFile) {
					content = await this.app.vault.cachedRead(activeFile);
					content = extractContentAfterTags(content);
					const _tags =
						this.app.metadataCache.getFileCache(activeFile)?.tags;
					if (_tags) {
						tags = _tags.map((tag) => tag.tag.replace("#", ""));
					}
				}

				const note = {
					name: filename,
					content: content,
					tags: tags,
					group: null,
				};

				new UploadModal(this.app, this.uploadNote, note).open();
			},
		);

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, "click", (evt: MouseEvent) => {
			console.log("click", evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(
			window.setInterval(() => console.log("setInterval"), 5 * 60 * 1000),
		);
	}

	onunload() {}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData(),
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class UploadModal extends Modal {
	result: string;
	onSubmit: (note: Note) => void;
	note: Note;

	constructor(app: App, onSubmit: (note: Note) => void, note: Note) {
		super(app);
		this.onSubmit = onSubmit;
		this.note = note;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl("h1", { text: "Uploading note" });

		new Setting(contentEl).setName("Group").addText((text) =>
			text.onChange((value) => {
				this.result = value;
			}),
		);

		new Setting(contentEl).addButton((btn) =>
			btn
				.setButtonText("Submit")
				.setCta()
				.onClick(() => {
					this.close();
					this.note.group = this.result;
					this.onSubmit(this.note);
				}),
		);
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SettingTab extends PluginSettingTab {
	plugin: NoteUploaderPlugin;

	constructor(app: App, plugin: NoteUploaderPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl).setName("Upload url").addText((text) =>
			text.setValue(this.plugin.settings.url).onChange(async (value) => {
				this.plugin.settings.url = value;
				await this.plugin.saveSettings();
			}),
		);
	}
}
