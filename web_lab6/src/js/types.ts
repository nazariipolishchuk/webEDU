// js/types.ts: the types of the domain. Only types: the whole module disappears after compilation.

// ---------- The local catalogue (index.html) ----------

export type Modality =
  | "chest-xray"
  | "brain-mri"
  | "ecg"
  | "dermatoscopy"
  | "histology"
  | "fundus"
  | "lung-ct"
  | "bone-xray";

export type DatasetStatus = "ready" | "collecting" | "review";

export interface Dataset {
  readonly id: string; // crypto.randomUUID() or sample-<code>; a record never changes it
  readonly code: string; // CXR-1001: unique, checked when the record is added
  readonly modality: Modality;
  title: string;
  status: DatasetStatus;
  quantity: number; // scans
  price: number; // per scan, in whole kopiykas: 0.1 + 0.2 !== 0.3 must not reach the totals
  selected: boolean; // chosen for training
  text?: string; // the description field of the form is optional
}

// The add form fills everything except what the catalogue gives itself
export type DatasetDraft = Omit<Dataset, "id" | "selected">;
// The edit card and the Selected button change some of the fields
export type DatasetPatch = Partial<
  Pick<Dataset, "title" | "quantity" | "price" | "status" | "selected">
>;

export type StatusFilter = DatasetStatus | "all";
export type SelectionFilter = "all" | "selected" | "not-selected";
export type SortKey =
  "title-asc" | "title-desc" | "price-asc" | "price-desc" | "quantity-desc" | "value-desc";

export interface ViewSettings {
  status: StatusFilter;
  selection: SelectionFilter;
  sort: SortKey;
  query: string; // the search is not saved: a new visit starts with an empty field
}

// What localStorage keeps between visits
export type SavedView = Omit<ViewSettings, "query">;

export interface CatalogueState {
  items: Dataset[];
  view: ViewSettings;
  editingId: string | null; // the card open for editing
}

// How the saved catalogue was read: ok | empty (nothing saved yet) | damaged | partial (bad records skipped)
export type LoadCondition = "ok" | "empty" | "damaged" | "partial";

// ---------- The publications API (api.html, JSONPlaceholder) ----------

export interface Post {
  readonly id: number;
  readonly userId: number; // the curator
  title: string;
  body: string;
}

export interface Address {
  street: string;
  city: string;
}

export interface Company {
  name: string;
  catchPhrase?: string;
}

export interface User {
  readonly id: number;
  name: string;
  username: string;
  email: string;
  phone?: string;
  website?: string;
  address?: Address;
  company?: Company;
}

// The list of curators needs only the name: the saved copy keeps nothing else
export type CuratorName = Pick<User, "id" | "name">;

export interface Comment {
  readonly id: number;
  readonly postId: number;
  name: string;
  email: string;
  body: string;
}

export interface Album {
  readonly id: number;
  readonly userId: number;
  title: string;
}

// The three resources of the curator's card
export interface Curator {
  user: User;
  posts: Post[];
  albums: Album[];
}

// What api.html keeps while it works
export interface PublicationsState {
  posts: Post[];
  users: Map<number, CuratorName>;
  query: string;
  userId: string; // the value of the curator list: "" means all curators
  page: number; // the last page loaded
  hasMore: boolean;
  savedAt: number; // Date.now() of the last successful load
}

// The copy of the last result in localStorage. A Map does not survive JSON.stringify,
// so the curators are an array there.
export interface SavedResult extends Omit<PublicationsState, "users"> {
  readonly savedAt: number;
  users: CuratorName[];
}

// ---------- States ----------

// The publications panel: one variant per state, each with the data that state shows
export type ListState =
  | { status: "loading"; text: string; keepList: boolean }
  | { status: "success" }
  | { status: "empty"; query: string }
  | { status: "error"; message: string; keptLabel: string };

// new: the first page of a new search; refresh: the loaded pages again; more: the next page
export type LoadMode = "new" | "refresh" | "more";
