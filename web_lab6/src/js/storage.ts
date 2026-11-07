// js/storage.ts: reads and writes the catalogue in localStorage, holds the sample data.
import { isKeyOf, isRecord } from "./guards.ts";
import type {
  Dataset,
  DatasetStatus,
  LoadCondition,
  Modality,
  SavedView,
  SelectionFilter,
  SortKey,
  StatusFilter,
} from "./types.ts";
import { read, write } from "./utils.ts";

const ITEMS_KEY = "drannotation-datasets";
const VIEW_KEY = "drannotation-view";

// Record<K, V>: every status must have a name, a missing or a misspelled one does not compile
const STATUSES: Record<DatasetStatus, string> = {
  ready: "Ready for training",
  collecting: "Collecting",
  review: "In review",
};

// Scan type: the image file name and its text alternative
const MODALITIES: Record<Modality, string> = {
  "chest-xray": "Chest X-ray with a box drawn around consolidation in the right lower lobe",
  "brain-mri": "Axial brain MRI slice with a glioma outlined",
  ecg: "ECG strip with irregular beats marked as atrial fibrillation",
  dermatoscopy: "Dermatoscopy image of a mole with an irregular border outlined",
  histology: "H&E stained tissue with a region of invasive carcinoma outlined",
  fundus: "Retinal photo with haemorrhages and exudates boxed",
  "lung-ct": "Lung CT slice with a six millimetre nodule circled",
  "bone-xray": "Wrist X-ray with a distal radius fracture boxed",
};

// The values the view settings may take, as tables: isKeyOf checks a stored value against them
const SELECTIONS: Record<SelectionFilter, true> = {
  all: true,
  selected: true,
  "not-selected": true,
};
const SORTS: Record<SortKey, true> = {
  "title-asc": true,
  "title-desc": true,
  "price-asc": true,
  "price-desc": true,
  "quantity-desc": true,
  "value-desc": true,
};

export const isStatusFilter = (value: unknown): value is StatusFilter =>
  value === "all" || isKeyOf(STATUSES, value);
export const isSelection = (value: unknown): value is SelectionFilter => isKeyOf(SELECTIONS, value);
export const isSortKey = (value: unknown): value is SortKey => isKeyOf(SORTS, value);
export const isDatasetStatus = (value: unknown): value is DatasetStatus => isKeyOf(STATUSES, value);
export const isModality = (value: unknown): value is Modality => isKeyOf(MODALITIES, value);

// Prices are whole kopiykas: 0.1 + 0.2 !== 0.3 must not reach the totals
const dataset = (
  code: string,
  title: string,
  modality: Modality,
  status: DatasetStatus,
  quantity: number,
  price: number,
  selected: boolean,
  text: string,
): Dataset => ({
  id: `sample-${code}`,
  code,
  title,
  modality,
  status,
  quantity,
  price,
  selected,
  text,
});

const sample = (): Dataset[] => [
  dataset(
    "CXR-1001",
    "Chest X-ray: pneumonia",
    "chest-xray",
    "ready",
    12480,
    450,
    true,
    "Frontal views of adults. Two radiologists labelled every scan independently.",
  ),
  dataset(
    "BMR-1002",
    "Brain MRI: tumours",
    "brain-mri",
    "ready",
    6920,
    720,
    true,
    "T1 and T2 axial slices with tumour borders traced by neuroradiologists.",
  ),
  dataset(
    "ECG-1003",
    "ECG: arrhythmias",
    "ecg",
    "collecting",
    9305,
    280,
    false,
    "Twelve-lead recordings with a cardiologist's report: atrial fibrillation, blocks, ectopic beats.",
  ),
  dataset(
    "DRM-1004",
    "Dermatoscopy: melanoma",
    "dermatoscopy",
    "collecting",
    4118,
    360,
    false,
    "Close-ups of skin lesions, paired with the biopsy result whenever one was taken.",
  ),
  dataset(
    "HST-1005",
    "Histology: breast cancer",
    "histology",
    "review",
    2760,
    1240,
    false,
    "Scanned H&E slides with tumour regions marked by pathologists.",
  ),
  dataset(
    "RET-1006",
    "Retina: diabetic retinopathy",
    "fundus",
    "ready",
    5640,
    310,
    true,
    "Fundus photos graded on the international scale by ophthalmologists.",
  ),
  dataset(
    "LCT-1007",
    "Lung CT: nodules",
    "lung-ct",
    "collecting",
    3215,
    975,
    false,
    "Full series with the position and size of every nodule larger than 3 mm.",
  ),
  dataset(
    "BXR-1008",
    "Bone X-ray: fractures",
    "bone-xray",
    "review",
    3776,
    325,
    false,
    "Hand and wrist films from trauma units with each fracture line marked.",
  ),
];

// Scans and kopiykas: whole numbers from zero up
const isWholeAmount = (value: unknown): value is number =>
  typeof value === "number" && Number.isInteger(value) && value >= 0;

// The storage can be edited by hand, so nothing read from it is trusted
const isDataset = (item: unknown): item is Dataset =>
  isRecord(item) &&
  typeof item.id === "string" &&
  item.id !== "" &&
  typeof item.code === "string" &&
  typeof item.title === "string" &&
  item.title.trim() !== "" &&
  (item.text === undefined || typeof item.text === "string") &&
  isModality(item.modality) &&
  isDatasetStatus(item.status) &&
  isWholeAmount(item.quantity) &&
  isWholeAmount(item.price) &&
  typeof item.selected === "boolean";

const load = (): { items: Dataset[]; condition: LoadCondition } => {
  const stored = read(ITEMS_KEY);
  if (stored.state === "missing") return { items: sample(), condition: "empty" };
  if (stored.state === "damaged" || !Array.isArray(stored.value)) {
    return { items: sample(), condition: "damaged" };
  }

  // Array.isArray narrowed the value to any[]: as unknown[] keeps every element unchecked
  const value: unknown[] = stored.value;
  const valid = value.filter(isDataset);
  // A copied record with the same id would be edited and deleted together with the first one
  const items = valid.filter(
    (item, index) => valid.findIndex(({ id }) => id === item.id) === index,
  );
  return { items, condition: items.length === value.length ? "ok" : "partial" };
};

const save = (items: Dataset[]): boolean => write(ITEMS_KEY, items);

// Only the values the page offers are taken, the rest stay at their defaults
const loadView = (): Partial<SavedView> => {
  const stored = read(VIEW_KEY);
  if (stored.state !== "found" || !isRecord(stored.value)) return {};
  const { status, selection, sort } = stored.value;
  const view: Partial<SavedView> = {};
  if (isStatusFilter(status)) view.status = status;
  if (isSelection(selection)) view.selection = selection;
  if (isSortKey(sort)) view.sort = sort;
  return view;
};

const saveView = ({ status, selection, sort }: SavedView): boolean =>
  write(VIEW_KEY, { status, selection, sort });

const clear = (): void => {
  localStorage.removeItem(ITEMS_KEY);
  localStorage.removeItem(VIEW_KEY);
};

export { ITEMS_KEY, MODALITIES, STATUSES, clear, load, loadView, sample, save, saveView };
