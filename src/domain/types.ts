export type ClipKind = "text" | "link" | "code" | "image" | "file" | "richText";
export type ColorPreset =
  | "teal"
  | "blue"
  | "indigo"
  | "violet"
  | "rose"
  | "coral"
  | "amber"
  | "slate"
  | "custom";
export type MousePasteTrigger = "singleClick" | "doubleClick";
export type OptionalClipFilter = "link" | "code" | "richText" | "recent" | "trash";
export type MotionPreset = "a" | "b" | "c" | "d";
export type SearchBoxPosition = "top" | "bottom" | "hidden";
export type WindowPositionMode = "remember" | "followMouse" | "screenCenter";

export interface SettingsShortcuts {
  showPanel: string;
  pasteSelected: string;
  copySelected: string;
  deleteSelected: string;
  nextItem: string;
  previousItem: string;
}

export interface ClipItem {
  id: string;
  text: string;
  preview: string;
  kind: ClipKind;
  contentHash: string;
  createdAt: string;
  lastUsedAt: string | null;
  useCount: number;
  isFavorite?: boolean;
  sourceAppName?: string | null;
  sourceAppIcon?: string | null;
  sourceAppPath?: string | null;
  richHtml?: string | null;
  deletedAt?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  fileCount?: number | null;
  filePaths?: string[];
}

export interface Settings {
  hotkey: string;
  shortcuts: SettingsShortcuts;
  historyLimit: number;
  retentionDays: number;
  trashRetentionDays: number;
  launchOnStartup: boolean;
  showTrayIcon: boolean;
  showTaskbarIcon: boolean;
  colorPreset: ColorPreset;
  customColor?: string;
  motionPreset: MotionPreset;
  panelPinned?: boolean;
  windowPosition: WindowPositionMode;
  copySound: boolean;
  searchBoxPosition: SearchBoxPosition;
  mousePasteTrigger: MousePasteTrigger;
  deleteConfirmation: boolean;
  edgeAutoHide: boolean;
  optionalFilters?: OptionalClipFilter[];
  capturePaused: boolean;
  themeMode: "system" | "light" | "dark";
}

export interface SettingsPatch {
  hotkey?: string;
  shortcuts?: Partial<SettingsShortcuts>;
  historyLimit?: number;
  retentionDays?: number;
  trashRetentionDays?: number;
  launchOnStartup?: boolean;
  showTrayIcon?: boolean;
  showTaskbarIcon?: boolean;
  colorPreset?: ColorPreset;
  customColor?: string;
  motionPreset?: MotionPreset;
  panelPinned?: boolean;
  windowPosition?: WindowPositionMode;
  copySound?: boolean;
  searchBoxPosition?: SearchBoxPosition;
  mousePasteTrigger?: MousePasteTrigger;
  deleteConfirmation?: boolean;
  edgeAutoHide?: boolean;
  optionalFilters?: OptionalClipFilter[];
  capturePaused?: boolean;
  themeMode?: Settings["themeMode"];
}

export type ClipFilter =
  | "all"
  | "text"
  | "favorite"
  | "image"
  | "file"
  | "link"
  | "code"
  | "richText"
  | "recent"
  | "trash";

export interface SearchState {
  query: string;
  filter: ClipFilter;
  selectedIndex: number;
}
