require("dotenv").config();
import { EvntComNode } from "evntcom-js/dist/node";
import SockJS from "sockjs-client";
import {
  Dictionary,
  ENotificationType,
  INotificationOptions,
  INotificationsSettings,
  IPartialTransform,
  ISceneItemSettings,
  ISceneNodeAddOptions,
  ISourceAddOptions,
  IVec2,
  TSourceType,
} from "./types";
import { ESlobsEvent } from "./ESlobsEvent";

const NAME: string = process.env.EVNTBOARD_NAME || "slobs";
const HOST: string = process.env.EVNTBOARD_HOST || "localhost";
const PORT: number = process.env.EVNTBOARD_PORT
  ? parseInt(process.env.EVNTBOARD_PORT)
  : 5001;
const SLOBS_HOST: string = process.env.EVNTBOARD_CONFIG_HOST;
const SLOBS_PORT: string = process.env.EVNTBOARD_CONFIG_PORT;
const SLOBS_TOKEN: string = process.env.EVNTBOARD_CONFIG_TOKEN;

const evntCom = new EvntComNode({
  name: NAME,
  port: PORT,
  host: HOST,
});

// real starting

let attemps: number = 0;
let connectionStatus: string = "disconnected";
let nextRequestId: number = 1;
let requests: Object = {};
let subscriptions: Object = {};
let socket: any = null;

evntCom.onEvent = ({ event, emitter }: any) => {
  if (emitter !== NAME) return;
  switch (event) {
    case ESlobsEvent.OPEN:
      attemps = 0;
      break;
    case ESlobsEvent.CLOSE:
      tryReconnect();
      break;
    default:
      break;
  }
};

const tryReconnect = () => {
  attemps += 1;
  console.log(`Attempt to reconnect TWITCH for the ${attemps} time(s)`);
  const waintingTime = attemps * 5000;
  setTimeout(() => load(), waintingTime);
};

const load = (evntCom.onOpen = async () => {
  await unload();
  await evntCom.callMethod("newEvent", [
    ESlobsEvent.LOAD,
    null,
    { emitter: NAME },
  ]);

  if (connectionStatus !== "disconnected") return;
  connectionStatus = "pending";
  socket = new SockJS(`http://${SLOBS_HOST}:${SLOBS_PORT}/api`);

  socket.onopen = () => {
    // send token for auth
    request("TcpServerService", "auth", SLOBS_TOKEN)
      .then(onConnectionHandler)
      .catch((e: Error) => {
        console.log(e.message);
      });
  };

  socket.onmessage = (e: any) => {
    onMessageHandler(e.data);
  };

  socket.onclose = (e: any) => {
    connectionStatus = "disconnected";
    console.log("disconnected: " + e.reason);
    evntCom.callMethod("newEvent", [ESlobsEvent.CLOSE, e]);
  };
});

const unload = async () => {
  try {
    connectionStatus = "disconnected";
    socket?.disconnect();
  } catch (e) {
    console.error(e.stack);
  }
};

const request = (
  resourceId: string,
  methodName: string,
  ...args: any[]
): any => {
  let id = nextRequestId++;
  let requestBody = {
    jsonrpc: "2.0",
    id,
    method: methodName,
    params: { resource: resourceId, args },
  };

  return sendMessage(requestBody);
};

const sendMessage = (message: any) => {
  let requestBody = message;
  if (typeof message === "string") {
    try {
      requestBody = JSON.parse(message);
    } catch (e) {
      console.log("Invalid JSON");
      return;
    }
  }

  if (!requestBody.id) {
    console.log("id is required");
    return;
  }

  return new Promise((resolve, reject) => {
    // @ts-ignore
    requests[requestBody.id] = {
      body: requestBody,
      resolve,
      reject,
      completed: false,
    };
    socket.send(JSON.stringify(requestBody));
  });
};

const onMessageHandler = (data: any) => {
  let message = JSON.parse(data);
  // @ts-ignore
  let request = requests[message.id];

  if (request) {
    if (message.error) {
      request.reject(message.error);
    } else {
      request.resolve(message.result);
    }
    // @ts-ignore
    delete requests[message.id];
  }

  const result = message.result;
  if (!result) return;

  if (result._type === "EVENT" && result.emitter === "STREAM") {
    // @ts-ignore
    subscriptions[message.result.resourceId](result.data);
  }
};

const subscribe = (resourceId: string, channelName: string, cb: any) => {
  request(resourceId, channelName).then(
    (subscriptionInfo: { resourceId: string | number }) => {
      // @ts-ignore
      subscriptions[subscriptionInfo.resourceId] = cb;
    }
  );
};

const onConnectionHandler = () => {
  connectionStatus = "connected";
  evntCom.callMethod("newEvent", [ESlobsEvent.OPEN, null, { emitter: NAME }]);

  // SceneCollectionsService

  subscribe("SceneCollectionsService", "collectionAdded", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.COLLECTION_ADDED,
      data,
      { emitter: NAME },
    ])
  );

  subscribe("SceneCollectionsService", "collectionRemoved", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.COLLECTION_REMOVED,
      data,
      { emitter: NAME },
    ])
  );

  subscribe("SceneCollectionsService", "collectionSwitched", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.COLLECTION_SWITCHED,
      data,
      { emitter: NAME },
    ])
  );

  subscribe("SceneCollectionsService", "collectionUpdated", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.COLLECTION_UPDATED,
      data,
      { emitter: NAME },
    ])
  );

  subscribe("SceneCollectionsService", "collectionWillSwitch", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.COLLECTION_WILLSWITCH,
      data,
      { emitter: NAME },
    ])
  );

  // ScenesService

  subscribe("ScenesService", "itemAdded", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.ITEM_ADDED,
      data,
      { emitter: NAME },
    ])
  );

  subscribe("ScenesService", "itemRemoved", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.ITEM_REMOVED,
      data,
      { emitter: NAME },
    ])
  );

  subscribe("ScenesService", "itemUpdated", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.ITEM_UPDATED,
      data,
      { emitter: NAME },
    ])
  );

  subscribe("ScenesService", "sceneAdded", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.SCENE_ADDED,
      data,
      { emitter: NAME },
    ])
  );

  subscribe("ScenesService", "sceneRemoved", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.SCENE_REMOVED,
      data,
      { emitter: NAME },
    ])
  );

  subscribe("ScenesService", "sceneSwitched", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.SCENE_SWITCHED,
      data,
      { emitter: NAME },
    ])
  );

  // Sources

  subscribe("SourcesService", "sourceAdded", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.SOURCE_ADDED,
      data,
      { emitter: NAME },
    ])
  );

  subscribe("SourcesService", "sourceRemoved", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.SOURCE_REMOVED,
      data,
      { emitter: NAME },
    ])
  );

  subscribe("SourcesService", "sourceUpdated", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.SOURCE_UPDATED,
      data,
      { emitter: NAME },
    ])
  );

  // streaming

  subscribe("StreamingService", "recordingStatusChange", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.RECORDING_STATUS_CHANGED,
      data,
      { emitter: NAME },
    ])
  );

  subscribe("StreamingService", "replayBufferStatusChange", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.REPLAY_STATUS_CHANGED,
      data,
      { emitter: NAME },
    ])
  );

  subscribe("StreamingService", "streamingStatusChange", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.STREAMING_STATUS_CHANGED,
      data,
      { emitter: NAME },
    ])
  );

  // Transitions

  subscribe("TransitionsService", "studioModeChanged", (data: any) =>
    evntCom.callMethod("newEvent", [
      ESlobsEvent.STUDIOMODE_STATUS_CHANGED,
      data,
      { emitter: NAME },
    ])
  );
};

// Helper

const registerAll = (obj: { [index: string]: any }) => {
  for (let key in obj) {
    evntCom.expose(key, obj[key]);
  }
};

registerAll({
  // AudioService
  AudioServiceGetSource: async (sourceId: string) =>
    await request("AudioService", "getSource", sourceId),
  AudioServiceGetSources: async () =>
    await request("AudioService", "getSources"),
  AudioServiceGetSourcesForCurrentScene: async () =>
    await request("AudioService", "getSourcesForCurrentScene"),
  AudioServiceGetSourcesForScene: async (sceneId: string) =>
    await request("AudioService", "getSourcesForScene", sceneId),

  // NotificationsService

  NotificationsServiceApplyAction: async (notificationId: number) =>
    await request("NotificationsService", "applyAction", notificationId),
  NotificationsServiceGetAll: async (type: ENotificationType) =>
    await request("NotificationsService", "getAll", type),
  NotificationsServiceGetNotification: async (id: number) =>
    await request("NotificationsService", "getNotification", id),
  NotificationsServiceGetRead: async (type: ENotificationType) =>
    await request("NotificationsService", "getRead", type),
  NotificationsServiceGetSettings: async () =>
    await request("NotificationsService", "getSettings"),
  NotificationsServiceGetUnread: async (type: ENotificationType) =>
    await request("NotificationsService", "getUnread", type),
  NotificationsServiceMarkAllAsRead: async () =>
    await request("NotificationsService", "markAllAsRead"),
  NotificationsServiceMarkAsRead: async (id: number) =>
    await request("NotificationsService", "markAsRead", id),
  NotificationsServicePush: async (notifyInfo: INotificationOptions) =>
    await request("NotificationsService", "push", notifyInfo),
  NotificationsServiceRestoreDefaultSettings: async () =>
    await request("NotificationsService", "restoreDefaultSettings"),
  NotificationsServiceSetSettings: async (
    patch: Partial<INotificationsSettings>
  ) => await request("NotificationsService", "setSettings", patch),
  NotificationsServiceShowNotifications: async () =>
    await request("NotificationsService", "showNotifications"),

  // PerformanceService

  PerformanceServiceGet: async () =>
    await request("PerformanceService", "getModel"),

  // SceneCollectionsService

  SceneCollectionsServiceGetActiveCollection: async () =>
    await request("SceneCollectionsService", "activeCollection"),
  SceneCollectionsServiceGetCollections: async () =>
    await request("SceneCollectionsService", "collections"),
  SceneCollectionsServiceCreate: async (options: { name: string }) =>
    await request("SceneCollectionsService", "create", options),
  SceneCollectionsServiceDelete: async (id?: string) =>
    await request("SceneCollectionsService", "delete", id),
  SceneCollectionsServiceFetchSchema: async () =>
    await request("SceneCollectionsService", "fetchSceneCollectionsSchema"),
  SceneCollectionsServiceLoad: async (id: string) =>
    await request("SceneCollectionsService", "load", id),
  SceneCollectionsServiceRename: async (id: string, newName: string) =>
    await request("SceneCollectionsService", "rename", newName, id),

  // Scenes

  ScenesServiceGetCurrent: async () =>
    await request("ScenesService", "activeScene"),
  ScenesServiceGetCurrentId: async () =>
    await request("ScenesService", "activeSceneId"),
  ScenesServiceCreate: async (name: string) =>
    await request("ScenesService", "createScene", name),
  ScenesServiceGet: async (id: string) =>
    await request("ScenesService", "getScene", id),
  ScenesServiceGetAll: async () => await request("ScenesService", "getScenes"),
  ScenesServiceSwitch: async (id: string) =>
    await request("ScenesService", "makeSceneActive", id),
  ScenesServiceRemove: async (id: string) =>
    await request("ScenesService", "removeScene", id),

  // SelectionService

  SelectionServiceGetSceneId: async () =>
    await request("SelectionService", "sceneId"),
  SelectionServiceAdd: async (ids: string[]) =>
    await request("SelectionService", "add", ids),
  SelectionServiceCenterOnScreen: async () =>
    await request("SelectionService", "centerOnScreen"),
  SelectionServiceClone: async () => await request("SelectionService", "clone"),
  SelectionServiceDeselect: async (ids: string[]) =>
    await request("SelectionService", "deselect", ids),
  SelectionServiceFitToScreen: async () =>
    await request("SelectionService", "fitToScreen"),
  SelectionServiceFlipX: async () => await request("SelectionService", "flipX"),
  SelectionServiceFlipY: async () => await request("SelectionService", "flipY"),
  SelectionServiceGetBoundingRect: async () =>
    await request("SelectionService", "getBoundingRect"),
  SelectionServiceGetFolders: async () =>
    await request("SelectionService", "getFolders"),
  SelectionServiceGetIds: async () =>
    await request("SelectionService", "getIds"),
  SelectionServiceGetInverted: async () =>
    await request("SelectionService", "getInverted"),
  SelectionServiceGetInvertedIds: async () =>
    await request("SelectionService", "getInvertedIds"),
  SelectionServiceGetItems: async () =>
    await request("SelectionService", "getItems"),
  SelectionServiceGetLastSelected: async () =>
    await request("SelectionService", "getLastSelected"),
  SelectionServiceGetLastSelectedId: async () =>
    await request("SelectionService", "getLastSelectedId"),
  SelectionServiceGetModel: async () =>
    await request("SelectionService", "getModel"),
  SelectionServiceGetRootNodes: async () =>
    await request("SelectionService", "getRootNodes"),
  SelectionServiceGetScene: async () =>
    await request("SelectionService", "getScene"),
  SelectionServiceGetSize: async () =>
    await request("SelectionService", "getSize"),
  SelectionServiceGetSources: async () =>
    await request("SelectionService", "getSources"),
  SelectionServiceGetVisualItems: async () =>
    await request("SelectionService", "getVisualItems"),
  SelectionServiceInvert: async () =>
    await request("SelectionService", "invert"),
  SelectionServiceIsSceneFolder: async () =>
    await request("SelectionService", "isSceneFolder"),
  SelectionServiceIsSceneItem: async () =>
    await request("SelectionService", "isSceneItem"),
  SelectionServiceIsSelected: async () =>
    await request("SelectionService", "isSelected"),
  SelectionServiceMoveTo: async (sceneId: string, folderId?: string) =>
    await request("SelectionService", "moveTo", sceneId, folderId),
  SelectionServicePlaceAfter: async (sceneNodeId: string) =>
    await request("SelectionService", "placeAfter", sceneNodeId),
  SelectionServicePlaceBefore: async (sceneNodeId: string) =>
    await request("SelectionService", "placeBefore", sceneNodeId),
  SelectionServiceRemove: async () =>
    await request("SelectionService", "remove"),
  SelectionServiceReset: async () => await request("SelectionService", "reset"),
  SelectionServiceResetTransform: async () =>
    await request("SelectionService", "resetTransform"),
  SelectionServiceRotate: async (deg: number) =>
    await request("SelectionService", "rotate", deg),
  SelectionServiceScale: async (scale: IVec2, origin?: IVec2) =>
    await request("SelectionService", "scale", scale, origin),
  SelectionServiceScaleWithOffSet: async (scale: IVec2, offset: IVec2) =>
    await request("SelectionService", "scaleWithOffset", scale, offset),
  SelectionServiceSelect: async (ids: string[]) =>
    await request("SelectionService", "select", ids),
  SelectionServiceSelectAll: async () =>
    await request("SelectionService", "selectAll"),
  SelectionServiceSetContentCrop: async () =>
    await request("SelectionService", "setContentCrop"),
  SelectionServiceSetParent: async (folderId: string) =>
    await request("SelectionService", "setParent", folderId),
  SelectionServiceSetRecordingVisible: async (recordingVisible: boolean) =>
    await request("SelectionService", "setRecordingVisible", recordingVisible),
  SelectionServiceSetSettings: async (settings: Partial<ISceneItemSettings>) =>
    await request("SelectionService", "setSettings", settings),
  SelectionServiceSetStreamVisible: async (streamVisible: boolean) =>
    await request("SelectionService", "setStreamVisible", streamVisible),
  SelectionServiceSetTransform: async (transform: IPartialTransform) =>
    await request("SelectionService", "setTransform", transform),
  SelectionServiceSetVisibility: async (visible: boolean) =>
    await request("SelectionService", "setVisibility", visible),
  SelectionServiceStretchToScreen: async () =>
    await request("SelectionService", "stretchToScreen"),
  SelectionServiceCopyTo: async (
    sceneId: string,
    folderId?: string,
    duplicateSources?: boolean
  ) => {
    return await request(
      "SelectionService",
      "copyTo",
      sceneId,
      folderId,
      duplicateSources
    );
  },

  // SourcesService

  SourcesServiceAddFile: async (path: string) =>
    await request("SourcesService", "addFile", path),

  SourcesServiceCreateSource: async (
    name: string,
    type: TSourceType,
    settings?: Dictionary<any>,
    options?: ISourceAddOptions
  ) => {
    return await request(
      "SourcesService",
      "createSource",
      name,
      type,
      settings,
      options
    );
  },

  SourcesServiceGetAvailableSourcesTypesList: async () => {
    return await request("SourcesService", "getAvailableSourcesTypesList");
  },

  SourcesServiceGet: async (sourceId: string) => {
    return await request("SourcesService", "getSource");
  },

  SourcesServiceGetAll: async () => {
    return await request("SourcesService", "getSources");
  },

  SourcesServiceGetByName: async (name: string) => {
    return await request("SourcesService", "getSourcesByName", name);
  },

  SourcesServiceRemove: async (id: string) => {
    return await request("SourcesService", "removeSource", id);
  },

  SourcesServiceShowAddSource: async (sourceType: TSourceType) => {
    return await request("SourcesService", "showAddSource", sourceType);
  },

  SourcesServiceShowShowcase: async () => {
    return await request("SourcesService", "showShowcase");
  },

  SourcesServiceShowSourceProperties: async (sourceId: string) => {
    return await request("SourcesService", "showSourceProperties", sourceId);
  },

  // StreamingService

  StreamingServiceGetModel: async () => {
    return await request("StreamingService", "getModel");
  },

  StreamingServiceSaveReplay: async () => {
    return await request("StreamingService", "saveReplay");
  },

  StreamingServiceStartReplayBuffer: async () => {
    return await request("StreamingService", "startReplayBuffer");
  },

  StreamingServiceStopReplayBuffer: async () => {
    return await request("StreamingService", "stopReplayBuffer");
  },

  StreamingServiceToggleRecording: async () => {
    return await request("StreamingService", "toggleRecording");
  },

  StreamingServiceToggleStreaming: async () => {
    return await request("StreamingService", "toggleStreaming");
  },

  // TransitionsService

  TransitionsServiceDisableStudioMode: async () => {
    return await request("TransitionsService", "disableStudioMode");
  },

  TransitionsServiceEnableStudioMode: async () => {
    return await request("TransitionsService", "enableStudioMode");
  },

  TransitionsServiceExecuteStudioModeTransition: async () => {
    return await request("TransitionsService", "executeStudioModeTransition");
  },

  TransitionsServiceGetModel: async () => {
    return await request("TransitionsService", "getModel");
  },

  // AudioSource

  AudioSourceGetModel: async (resourceId: string) => {
    return await request(resourceId, "getModel");
  },

  AudioSourceSetDeflection: async (resourceId: string, deflection: number) => {
    return await request(resourceId, "setDeflection", deflection);
  },

  AudioSourceSetMuted: async (resourceId: string, muted: boolean) => {
    return await request(resourceId, "setMuted", muted);
  },

  // Scene

  SceneAddFile: async (resourceId: string, path: string, folderId?: string) => {
    return await request(resourceId, "addFile", path, folderId);
  },

  SceneAddSource: async (
    resourceId: string,
    sourceId: string,
    options?: ISceneNodeAddOptions
  ) => {
    return await request(resourceId, "addSource", sourceId, options);
  },

  SceneCanAddSource: async (resourceId: string, sourceId: string) => {
    return await request(resourceId, "canAddSource", sourceId);
  },

  SceneClear: async (resourceId: string) => {
    return await request(resourceId, "clear");
  },

  SceneCreateAndAddSource: async (
    resourceId: string,
    name: string,
    type: TSourceType,
    settings?: Dictionary<any>
  ) => {
    return await request(
      resourceId,
      "createAndAddSource",
      name,
      type,
      settings
    );
  },

  SceneCreateFolder: async (resourceId: string, name: string) => {
    return await request(resourceId, "createFolder", name);
  },

  SceneGetFolder: async (resourceId: string, sceneFolderId: string) => {
    return await request(resourceId, "getFolder", sceneFolderId);
  },

  SceneGetFolders: async (resourceId: string) => {
    return await request(resourceId, "getFolders");
  },

  SceneGetItem: async (resourceId: string, sceneItemId: string) => {
    return await request(resourceId, "getItem", sceneItemId);
  },

  SceneGetItems: async (resourceId: string) => {
    return await request(resourceId, "getItems");
  },

  SceneGetModel: async (resourceId: string) => {
    return await request(resourceId, "getModel");
  },

  SceneGetNestedItems: async (resourceId: string) => {
    return await request(resourceId, "getNestedItems");
  },

  SceneGetNestedScenes: async (resourceId: string) => {
    return await request(resourceId, "getNestedScenes");
  },

  SceneGetNestedSources: async (resourceId: string) => {
    return await request(resourceId, "getNestedSources");
  },

  SceneGetNode: async (resourceId: string, sceneNodeId: string) => {
    return await request(resourceId, "getNode", sceneNodeId);
  },

  SceneGetNodeByName: async (resourceId: string, name: string) => {
    return await request(resourceId, "getNodeByName", name);
  },

  SceneGetNodes: async (resourceId: string) => {
    return await request(resourceId, "getNodes");
  },

  SceneGetRootNodes: async (resourceId: string) => {
    return await request(resourceId, "getRootNodes");
  },

  SceneGetSelection: async (resourceId: string, ids?: string[]) => {
    return await request(resourceId, "getSelection", ids);
  },

  SceneGetSource: async (resourceId: string) => {
    return await request(resourceId, "getSource");
  },

  SceneMakeActive: async (resourceId: string) => {
    return await request(resourceId, "makeActive");
  },

  SceneRemove: async (resourceId: string) => {
    return await request(resourceId, "remove");
  },

  SceneRemoveFolder: async (resourceId: string, folderId: string) => {
    return await request(resourceId, "removeFolder", folderId);
  },

  SceneRemoveItem: async (resourceId: string, sceneItemId: string) => {
    return await request(resourceId, "removeItem", sceneItemId);
  },

  SceneSetName: async (resourceId: string, newName: string) => {
    return await request(resourceId, "setName", newName);
  },

  // SceneItem

  SceneItemAddToSelection: async (resourceId: string) => {
    return await request(resourceId, "addToSelection");
  },

  SceneItemCenterOnScreen: async (resourceId: string) => {
    return await request(resourceId, "centerOnScreen");
  },

  SceneItemDeselect: async (resourceId: string) => {
    return await request(resourceId, "deselect");
  },

  SceneItemDetachParent: async (resourceId: string) => {
    return await request(resourceId, "detachParent");
  },

  SceneItemFitToScreen: async (resourceId: string) => {
    return await request(resourceId, "fitToScreen");
  },

  SceneItemFlipX: async (resourceId: string) => {
    return await request(resourceId, "flipX");
  },

  SceneItemFlipY: async (resourceId: string) => {
    return await request(resourceId, "flipY");
  },

  SceneItemGetItemIndex: async (resourceId: string) => {
    return await request(resourceId, "getItemIndex");
  },

  SceneItemGetModel: async (resourceId: string) => {
    return await request(resourceId, "getModel");
  },

  SceneItemGetNextItem: async (resourceId: string) => {
    return await request(resourceId, "getNextItem");
  },

  SceneItemGetNextNode: async (resourceId: string) => {
    return await request(resourceId, "getNextNode");
  },

  SceneItemGetNodeIndex: async (resourceId: string) => {
    return await request(resourceId, "getNodeIndex");
  },

  SceneItemGetParent: async (resourceId: string) => {
    return await request(resourceId, "getParent");
  },

  SceneItemGetPath: async (resourceId: string) => {
    return await request(resourceId, "getPath");
  },

  SceneItemGetPrevItem: async (resourceId: string) => {
    return await request(resourceId, "getPrevItem");
  },

  SceneItemGetPrevNode: async (resourceId: string) => {
    return await request(resourceId, "getPrevNode");
  },

  SceneItemGetScene: async (resourceId: string) => {
    return await request(resourceId, "getScene");
  },

  SceneItemGetSource: async (resourceId: string) => {
    return await request(resourceId, "getSource");
  },

  SceneItemHasParent: async (resourceId: string) => {
    return await request(resourceId, "hasParent");
  },

  SceneItemIsFolder: async (resourceId: string) => {
    return await request(resourceId, "isFolder");
  },

  SceneItemIsItem: async (resourceId: string) => {
    return await request(resourceId, "isItem");
  },

  SceneItemIsSelected: async (resourceId: string) => {
    return await request(resourceId, "isSelected");
  },

  SceneItemPlaceAfter: async (resourceId: string, nodeId: string) => {
    return await request(resourceId, "placeAfter", nodeId);
  },

  SceneItemPlaceBefore: async (resourceId: string, nodeId: string) => {
    return await request(resourceId, "placeBefore", nodeId);
  },

  SceneItemRemove: async (resourceId: string) => {
    return await request(resourceId, "remove");
  },

  SceneItemResetTransform: async (resourceId: string) => {
    return await request(resourceId, "resetTransform");
  },

  SceneItemRotate: async (resourceId: string, deg: number) => {
    return await request(resourceId, "rotate", deg);
  },

  SceneItemSelect: async (resourceId: string) => {
    return await request(resourceId, "select");
  },

  SceneItemSetContentCrop: async (resourceId: string) => {
    return await request(resourceId, "setContentCrop");
  },

  SceneItemSetParent: async (resourceId: string, parentId: string) => {
    return await request(resourceId, "setParent", parentId);
  },

  SceneItemSetScale: async (
    resourceId: string,
    newScaleModel: IVec2,
    origin?: IVec2
  ) => {
    return await request(resourceId, "setScale", newScaleModel, origin);
  },

  SceneItemSetSettings: async (
    resourceId: string,
    settings: Partial<ISceneItemSettings>
  ) => {
    return await request(resourceId, "setSettings", settings);
  },

  SceneItemSetTransform: async (
    resourceId: string,
    transform: IPartialTransform
  ) => {
    return await request(resourceId, "setTransform", transform);
  },

  SceneItemSetVisibility: async (resourceId: string, visible: boolean) => {
    return await request(resourceId, "setVisibility", visible);
  },

  SceneItemStretchToScreen: async (resourceId: string) => {
    return await request(resourceId, "stretchToScreen");
  },

  // Source

  SourceDuplicate: async (resourceId: string) => {
    return await request(resourceId, "duplicate");
  },

  SourceGetModel: async (resourceId: string) => {
    return await request(resourceId, "getModel");
  },

  SourceGetProperties: async (resourceId: string) => {
    return await request(resourceId, "getPropertiesFormData");
  },

  SourceGetSettings: async (resourceId: string) => {
    return await request(resourceId, "getSettings");
  },

  SourceHasProps: async (resourceId: string) => {
    return await request(resourceId, "hasProps");
  },

  SourceRefresh: async (resourceId: string) => {
    return await request(resourceId, "refresh");
  },

  SourceSetName: async (resourceId: string, newName: string) => {
    return await request(resourceId, "setName");
  },

  SourceSetProperties: async (resourceId: string) => {
    return await request(resourceId, "setPropertiesFormData");
  },
});
