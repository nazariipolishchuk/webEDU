// js/storage.js: reads and writes the catalogue in localStorage, holds the sample data.
(function (App) {
  "use strict";

  const ITEMS_KEY = "drannotation-datasets";
  const VIEW_KEY = "drannotation-view";

  const STATUSES = {
    ready: "Ready for training",
    collecting: "Collecting",
    review: "In review",
  };

  // Scan type: the image file name and its text alternative
  const MODALITIES = {
    "chest-xray": "Chest X-ray with a box drawn around consolidation in the right lower lobe",
    "brain-mri": "Axial brain MRI slice with a glioma outlined",
    ecg: "ECG strip with irregular beats marked as atrial fibrillation",
    dermatoscopy: "Dermatoscopy image of a mole with an irregular border outlined",
    histology: "H&E stained tissue with a region of invasive carcinoma outlined",
    fundus: "Retinal photo with haemorrhages and exudates boxed",
    "lung-ct": "Lung CT slice with a six millimetre nodule circled",
    "bone-xray": "Wrist X-ray with a distal radius fracture boxed",
  };

  // Prices are whole kopiykas: 0.1 + 0.2 !== 0.3 must not reach the totals
  const dataset = (code, title, modality, status, quantity, price, selected, text) => ({
    id: `sample-${code}`, code, title, modality, status, quantity, price, selected, text,
  });

  const sample = () => [
    dataset("CXR-1001", "Chest X-ray: pneumonia", "chest-xray", "ready", 12480, 450, true,
      "Frontal views of adults. Two radiologists labelled every scan independently."),
    dataset("BMR-1002", "Brain MRI: tumours", "brain-mri", "ready", 6920, 720, true,
      "T1 and T2 axial slices with tumour borders traced by neuroradiologists."),
    dataset("ECG-1003", "ECG: arrhythmias", "ecg", "collecting", 9305, 280, false,
      "Twelve-lead recordings with a cardiologist's report: atrial fibrillation, blocks, ectopic beats."),
    dataset("DRM-1004", "Dermatoscopy: melanoma", "dermatoscopy", "collecting", 4118, 360, false,
      "Close-ups of skin lesions, paired with the biopsy result whenever one was taken."),
    dataset("HST-1005", "Histology: breast cancer", "histology", "review", 2760, 1240, false,
      "Scanned H&E slides with tumour regions marked by pathologists."),
    dataset("RET-1006", "Retina: diabetic retinopathy", "fundus", "ready", 5640, 310, true,
      "Fundus photos graded on the international scale by ophthalmologists."),
    dataset("LCT-1007", "Lung CT: nodules", "lung-ct", "collecting", 3215, 975, false,
      "Full series with the position and size of every nodule larger than 3 mm."),
    dataset("BXR-1008", "Bone X-ray: fractures", "bone-xray", "review", 3776, 325, false,
      "Hand and wrist films from trauma units with each fracture line marked."),
  ];

  // The storage can be edited by hand, so nothing read from it is trusted
  const isDataset = (item) =>
    item !== null && typeof item === "object"
    && typeof item.id === "string" && item.id !== ""
    && typeof item.code === "string"
    && typeof item.title === "string" && item.title.trim() !== ""
    && typeof item.text === "string"
    && Object.hasOwn(MODALITIES, item.modality)
    && Object.hasOwn(STATUSES, item.status)
    && Number.isInteger(item.quantity) && item.quantity >= 0
    && Number.isInteger(item.price) && item.price >= 0
    && typeof item.selected === "boolean";

  const read = (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? { missing: true } : { value: JSON.parse(raw) };
    } catch (error) {
      // SyntaxError: damaged JSON. DOMException: the browser blocks the storage.
      if (error instanceof SyntaxError || error instanceof DOMException) return { damaged: true };
      throw error;
    }
  };

  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      if (error instanceof DOMException) return false; // storage is full or blocked
      throw error;
    }
  };

  // condition: ok | empty (nothing saved yet) | damaged (unreadable) | partial (bad records skipped)
  const load = () => {
    const { missing, damaged, value } = read(ITEMS_KEY);
    if (missing) return { items: sample(), condition: "empty" };
    if (damaged || !Array.isArray(value)) return { items: sample(), condition: "damaged" };

    const items = value.filter((item, index) =>
      isDataset(item) && value.findIndex((other) => other?.id === item.id) === index);
    return { items, condition: items.length === value.length ? "ok" : "partial" };
  };

  const save = (items) => write(ITEMS_KEY, items);

  const loadView = () => {
    const { value } = read(VIEW_KEY);
    return value !== null && typeof value === "object" ? value : {};
  };

  const saveView = ({ status, selection, sort }) => write(VIEW_KEY, { status, selection, sort });

  const clear = () => {
    localStorage.removeItem(ITEMS_KEY);
    localStorage.removeItem(VIEW_KEY);
  };

  App.storage = { ITEMS_KEY, MODALITIES, STATUSES, clear, load, loadView, sample, save, saveView };
})(window.App = window.App || {});
