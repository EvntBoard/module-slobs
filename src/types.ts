export interface Dictionary<TItemType> {
  [key: string]: TItemType;
}

export interface IRectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface IScalableRectangle extends IRectangle {
  scaleX?: number;
  scaleY?: number;
  crop?: ICrop;
  rotation?: number;
}

export interface IVec2 {
  x: number;
  y: number;
}

export interface ICrop {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface IRGBColor {
  r: number;
  g: number;
  b: number;
}

export interface ISceneItemSettings {
  transform: ITransform;
  visible: boolean;
  locked: boolean;
  streamVisible: boolean;
  recordingVisible: boolean;
}

export interface ITransform {
  position: IVec2;
  scale: IVec2;
  crop: ICrop;
  rotation: number;
}

export interface IPartialTransform {
  position?: Partial<IVec2>;
  scale?: Partial<IVec2>;
  crop?: Partial<ICrop>;
  rotation?: number;
}

export interface IJsonRpcRequest {
  jsonrpc: "2.0";
  id: string;
  method: string;
  params: {
    resource: string;
    args?: any[];
    fetchMutations?: boolean;
    compactMode?: boolean;
    noReturn?: boolean;
    windowId?: string;
  };
}

export type TSourceType =
  | "image_source"
  | "color_source"
  | "browser_source"
  | "slideshow"
  | "ffmpeg_source"
  | "text_gdiplus"
  | "text_ft2_source"
  | "monitor_capture"
  | "window_capture"
  | "game_capture"
  | "dshow_input"
  | "wasapi_input_capture"
  | "wasapi_output_capture"
  | "decklink-input"
  | "scene"
  | "ndi_source"
  | "openvr_capture"
  | "liv_capture"
  | "ovrstream_dc_source"
  | "vlc_source";

export enum ENotificationType {
  INFO = "INFO",
  WARNING = "WARNING",
  SUCCESS = "SUCCESS",
}

export enum ENotificationSubType {
  DEFAULT = "DEFAULT",
  DISCONNECTED = "DISCONNECTED",
  DROPPED = "DROPPED",
  LAGGED = "LAGGED",
  SKIPPED = "SKIPPED",
}

export interface INotificationOptions {
  message: string;
  code?: string;
  unread?: boolean;
  type?: ENotificationType;
  action?: IJsonRpcRequest;
  playSound?: boolean;
  data?: any;
  subType?: ENotificationSubType;

  /** The notification's life time in ms. Use -1 for infinity */
  lifeTime?: number;
  showTime?: boolean;
}

export interface INotificationModel extends INotificationOptions {
  id: number;
  type: ENotificationType;
  message: string;
  unread: boolean;
  date: number;
  playSound: boolean;
  lifeTime: number;
  showTime: boolean;
  subType: ENotificationSubType;
}

export interface INotificationsSettings {
  enabled: boolean;
  playSound: boolean;
}

export interface ISourceAddOptions {
  channel?: number;
  isTemporary?: boolean;
}

export interface ISceneNodeAddOptions {
  id?: string; // A new ID will be assigned if one is not provided
  sourceAddOptions?: ISourceAddOptions;
}
