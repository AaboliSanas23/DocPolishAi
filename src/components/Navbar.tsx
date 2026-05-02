import { Upload, Wand2, Eye, Download } from "lucide-react";

interface Props {
  onPreview: () => void;
  onExport: () => void;
  onAutoFix: () => void;
  onUpload: (file: File) => void;
  previewMode: boolean;
  hasDocument: boolean;
}

const Navbar = ({
  onPreview,
  onExport,
  onAutoFix,
  onUpload,
  previewMode,
  hasDocument,
}: Props) => {
  return (
    <div className="bg-white border-b px-6 py-4 flex justify-between items-center shadow-sm">
      <h1 className="text-2xl font-bold text-indigo-600">DocPolishAI</h1>

      <div className="flex gap-3">
        {/* Upload */}
        <label className="px-4 py-2 border rounded-lg flex gap-2 items-center cursor-pointer hover:bg-gray-50">
          <Upload size={18} />
          Upload New
          <input
            type="file"
            accept=".docx"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];

              if (file) {
                onUpload(file);
              }
            }}
          />
        </label>

        {hasDocument && (
          <>
            {/* Auto Fix */}
            <button
              onClick={onAutoFix}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg flex gap-2 items-center"
            >
              <Wand2 size={18} />
              Auto Fix
            </button>

            {/* Preview */}
            <button
              onClick={onPreview}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg flex gap-2 items-center"
            >
              <Eye size={18} />
              {previewMode ? "Edit Mode" : "Preview"}
            </button>

            {/* Export */}
            <button
              onClick={onExport}
              className="px-4 py-2 bg-green-600 text-white rounded-lg flex gap-2 items-center"
            >
              <Download size={18} />
              Export
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default Navbar;
