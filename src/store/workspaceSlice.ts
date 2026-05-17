import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import { DocumentBlock } from "../types/document";
import {
  DEFAULT_STYLE_CONFIG,
  type StyleConfig,
} from "../types/style";

export interface WorkspaceState {
  blocks: DocumentBlock[];
  originalHtml: string;
  styles: StyleConfig;
  previewMode: boolean;
}

const initialState: WorkspaceState = {
  blocks: [],
  originalHtml: "",
  styles: { ...DEFAULT_STYLE_CONFIG },
  previewMode: false,
};

const workspaceSlice = createSlice({
  name: "workspace",
  initialState,
  reducers: {
    setBlocks(
      state,
      action: PayloadAction<DocumentBlock[]>
    ) {
      state.blocks = action.payload;
    },
    setOriginalHtml(
      state,
      action: PayloadAction<string>
    ) {
      state.originalHtml = action.payload;
    },
    setStyles(
      state,
      action: PayloadAction<StyleConfig>
    ) {
      state.styles = action.payload;
    },
    setPreviewMode(
      state,
      action: PayloadAction<boolean>
    ) {
      state.previewMode = action.payload;
    },
    togglePreviewMode(state) {
      state.previewMode = !state.previewMode;
    },
    resetWorkspaceDocument(state) {
      state.blocks = [];
      state.originalHtml = "";
      state.previewMode = false;
    },
  },
});

export const {
  setBlocks,
  setOriginalHtml,
  setStyles,
  setPreviewMode,
  togglePreviewMode,
  resetWorkspaceDocument,
} = workspaceSlice.actions;

export default workspaceSlice.reducer;
