import process from 'process';
import { EvntComClient, EvntComServer } from "evntboard-communicate";
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

// parse params
const { name: NAME, customName: CUSTOM_NAME, config: { host: HOST, port: PORT, token: TOKEN } } = JSON.parse(process.argv[2]);
const EMITTER = CUSTOM_NAME || NAME;

// create Client and Server COM
const evntComClient = new EvntComClient(
    (cb: any) => process.on('message', cb),
    (data: any) => process.send(data),
);

const evntComServer = new EvntComServer();

evntComServer.registerOnData((cb: any) => process.on('message', async (data: any) => {
  const toSend = await cb(data);
  if (toSend) process.send(toSend);
}));

// real starting

let attemps: number = 0;
let connectionStatus: string = "disconnected";
let nextRequestId: number = 1;
let requests: Object = {};
let subscriptions: Object = {};
let socket: any = null;

const onNewEvent = ({ event, emitter }: any) => {
  if (emitter !== EMITTER) return;
  switch (event) {
    case ESlobsEvent.OPEN:
      attemps = 0;
      break;
    case ESlobsEvent.CLOSE:
      tryReconnect()
      break;
    default:
      break;
  }
}

const tryReconnect = () => {
  attemps += 1;
  console.log(`Attempt to reconnect TWITCH for the ${attemps} time(s)`);
  const waintingTime = attemps * 5000;
  setTimeout(() => load(), waintingTime);
}

const load = async () => {
  evntComClient.newEvent(ESlobsEvent.LOAD, null, { emitter: EMITTER });

  if (connectionStatus !== "disconnected") return;
  connectionStatus = "pending";
  socket = new SockJS(`http://${HOST}:${PORT}/api`);

  socket.onopen = () => {
    // send token for auth
    request("TcpServerService", "auth", TOKEN)
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
    evntComClient.newEvent(ESlobsEvent.CLOSE, e);
  };
}

const unload = async () => {
  try {
    connectionStatus = "disconnected";
    socket.disconnect();
    evntComClient.newEvent(ESlobsEvent.UNLOAD, null, { emitter: EMITTER });
  } catch (e) {
    console.error(e.stack);
  }
}

const reload = async () => {
  await unload();
  await load();
}

const request = (resourceId: string, methodName: string, ...args: any[]): any => {
  let id = nextRequestId++;
  let requestBody = {
    jsonrpc: "2.0",
    id,
    method: methodName,
    params: { resource: resourceId, args },
  };

  return sendMessage(requestBody);
}

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
}

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
}

const subscribe = (resourceId: string, channelName: string, cb: any) => {
  request(resourceId, channelName).then(
      (subscriptionInfo: { resourceId: string | number }) => {
        // @ts-ignore
        subscriptions[subscriptionInfo.resourceId] = cb;
      }
  );
}

const onConnectionHandler = () => {
  connectionStatus = "connected";
  evntComClient.newEvent(ESlobsEvent.OPEN, null, { emitter: EMITTER });

  // SceneCollectionsService

  subscribe(
      "SceneCollectionsService",
      "collectionAdded",
      (data: any) => evntComClient.newEvent(ESlobsEvent.COLLECTION_ADDED, data, { emitter: EMITTER })
  );

  subscribe(
      "SceneCollectionsService",
      "collectionRemoved",
      (data: any) => evntComClient.newEvent(ESlobsEvent.COLLECTION_REMOVED, data, { emitter: EMITTER })
  );

  subscribe(
      "SceneCollectionsService",
      "collectionSwitched",
      (data: any) => evntComClient.newEvent(ESlobsEvent.COLLECTION_SWITCHED, data, { emitter: EMITTER })
  );

  subscribe(
      "SceneCollectionsService",
      "collectionUpdated",
      (data: any) => evntComClient.newEvent(ESlobsEvent.COLLECTION_UPDATED, data, { emitter: EMITTER })
  );

  subscribe(
      "SceneCollectionsService",
      "collectionWillSwitch",
      (data: any) => evntComClient.newEvent(ESlobsEvent.COLLECTION_WILLSWITCH, data, { emitter: EMITTER })
  );

  // ScenesService

  subscribe(
      "ScenesService",
      "itemAdded",
      (data: any) => evntComClient.newEvent(ESlobsEvent.ITEM_ADDED, data, { emitter: EMITTER })
  );

  subscribe(
      "ScenesService",
      "itemRemoved",
      (data: any) => evntComClient.newEvent(ESlobsEvent.ITEM_REMOVED, data, { emitter: EMITTER })
  );

  subscribe(
      "ScenesService",
      "itemUpdated",
      (data: any) => evntComClient.newEvent(ESlobsEvent.ITEM_UPDATED, data, { emitter: EMITTER })
  );

  subscribe(
      "ScenesService",
      "sceneAdded",
      (data: any) => evntComClient.newEvent(ESlobsEvent.SCENE_ADDED, data, { emitter: EMITTER })
  );

  subscribe(
      "ScenesService",
      "sceneRemoved",
      (data: any) => evntComClient.newEvent(ESlobsEvent.SCENE_REMOVED, data, { emitter: EMITTER })
  );

  subscribe(
      "ScenesService",
      "sceneSwitched",
      (data: any) => evntComClient.newEvent(ESlobsEvent.SCENE_SWITCHED, data, { emitter: EMITTER })
  );

  // Sources

  subscribe(
      "SourcesService",
      "sourceAdded",
      (data: any) => evntComClient.newEvent(ESlobsEvent.SOURCE_ADDED, data, { emitter: EMITTER })
  );

  subscribe(
      "SourcesService",
      "sourceRemoved",
      (data: any) =>evntComClient.newEvent(ESlobsEvent.SOURCE_REMOVED, data, { emitter: EMITTER })
  );

  subscribe(
      "SourcesService",
      "sourceUpdated",
      (data: any) => evntComClient.newEvent(ESlobsEvent.SOURCE_UPDATED, data, { emitter: EMITTER })
  );

  // streaming

  subscribe(
      "StreamingService",
      "recordingStatusChange",
      (data: any) => evntComClient.newEvent(ESlobsEvent.RECORDING_STATUS_CHANGED, data, { emitter: EMITTER })
  );

  subscribe(
      "StreamingService",
      "replayBufferStatusChange",
      (data: any) => evntComClient.newEvent(ESlobsEvent.REPLAY_STATUS_CHANGED, data, { emitter: EMITTER })
  );

  subscribe(
      "StreamingService",
      "streamingStatusChange",
      (data: any) => evntComClient.newEvent(ESlobsEvent.STREAMING_STATUS_CHANGED, data, { emitter: EMITTER })
  );

  // Transitions

  subscribe(
      "TransitionsService",
      "studioModeChanged",
      (data: any) => evntComClient.newEvent(ESlobsEvent.STUDIOMODE_STATUS_CHANGED, data, { emitter: EMITTER })
  );
}

evntComServer.expose("newEvent", onNewEvent);
evntComServer.expose("load", load);
evntComServer.expose("unload", unload);
evntComServer.expose("reload", reload);

// AudioService

const AudioServiceGetSource = async (sourceId: string) => await request("AudioService", "getSource", sourceId);
const AudioServiceGetSources = async () => await request("AudioService", "getSources");
const AudioServiceGetSourcesForCurrentScene = async ()  => await request("AudioService", "getSourcesForCurrentScene");
const AudioServiceGetSourcesForScene = async (sceneId: string) => await request("AudioService", "getSourcesForScene", sceneId);

evntComServer.expose("AudioServiceGetSource", AudioServiceGetSource);
evntComServer.expose("AudioServiceGetSources", AudioServiceGetSources);
evntComServer.expose("AudioServiceGetSourcesForCurrentScene", AudioServiceGetSourcesForCurrentScene);
evntComServer.expose("AudioServiceGetSourcesForScene", AudioServiceGetSourcesForScene);

// NotificationsService

const NotificationsServiceApplyAction = async (notificationId: number) => await request("NotificationsService", "applyAction", notificationId)
const NotificationsServiceGetAll = async (type: ENotificationType) => await request("NotificationsService", "getAll", type);
const NotificationsServiceGetNotification = async (id: number) => await request("NotificationsService", "getNotification", id);
const NotificationsServiceGetRead = async (type: ENotificationType) => await request("NotificationsService", "getRead", type);
const NotificationsServiceGetSettings = async () => await request("NotificationsService", "getSettings");
const NotificationsServiceGetUnread = async (type: ENotificationType) => await request("NotificationsService", "getUnread", type);
const NotificationsServiceMarkAllAsRead = async () => await request("NotificationsService", "markAllAsRead");
const NotificationsServiceMarkAsRead = async (id: number) => await request("NotificationsService", "markAsRead", id);
const NotificationsServicePush = async (notifyInfo: INotificationOptions) => await request("NotificationsService", "push", notifyInfo);
const NotificationsServiceRestoreDefaultSettings = async () => await request("NotificationsService", "restoreDefaultSettings");
const NotificationsServiceSetSettings = async (patch: Partial<INotificationsSettings>) => await request("NotificationsService", "setSettings", patch);
const NotificationsServiceShowNotifications = async () => await request("NotificationsService", "showNotifications");

evntComServer.expose("NotificationsServiceApplyAction", NotificationsServiceApplyAction);
evntComServer.expose("NotificationsServiceGetAll", NotificationsServiceGetAll);
evntComServer.expose("NotificationsServiceGetNotification", NotificationsServiceGetNotification);
evntComServer.expose("NotificationsServiceGetRead", NotificationsServiceGetRead);
evntComServer.expose("NotificationsServiceGetSettings", NotificationsServiceGetSettings);
evntComServer.expose("NotificationsServiceGetUnread", NotificationsServiceGetUnread);
evntComServer.expose("NotificationsServiceMarkAllAsRead", NotificationsServiceMarkAllAsRead);
evntComServer.expose("NotificationsServiceMarkAsRead", NotificationsServiceMarkAsRead);
evntComServer.expose("NotificationsServicePush", NotificationsServicePush);
evntComServer.expose("NotificationsServiceRestoreDefaultSettings", NotificationsServiceRestoreDefaultSettings);
evntComServer.expose("NotificationsServiceSetSettings", NotificationsServiceSetSettings);
evntComServer.expose("NotificationsServiceShowNotifications", NotificationsServiceShowNotifications);

// PerformanceService

const PerformanceServiceGet = async () => await request("PerformanceService", "getModel");

evntComServer.expose("PerformanceServiceGet", PerformanceServiceGet);

// SceneCollectionsService

const SceneCollectionsServiceGetActiveCollection = async () => await request("SceneCollectionsService", "activeCollection");
const SceneCollectionsServiceGetCollections = async () => await request("SceneCollectionsService", "collections");
const SceneCollectionsServiceCreate = async (options: { name: string }) => await request("SceneCollectionsService", "create", options);
const SceneCollectionsServiceDelete = async (id?: string) => await request("SceneCollectionsService", "delete", id);
const SceneCollectionsServiceFetchSchema = async () => await request("SceneCollectionsService", "fetchSceneCollectionsSchema");
const SceneCollectionsServiceLoad = async (id: string) => await request("SceneCollectionsService", "load", id);
const SceneCollectionsServiceRename = async (id: string, newName: string) => await request("SceneCollectionsService", "rename", newName, id);

evntComServer.expose("SceneCollectionsServiceGetActiveCollection", SceneCollectionsServiceGetActiveCollection);
evntComServer.expose("SceneCollectionsServiceGetCollections", SceneCollectionsServiceGetCollections);
evntComServer.expose("SceneCollectionsServiceCreate", SceneCollectionsServiceCreate);
evntComServer.expose("SceneCollectionsServiceDelete", SceneCollectionsServiceDelete);
evntComServer.expose("SceneCollectionsServiceFetchSchema", SceneCollectionsServiceFetchSchema);
evntComServer.expose("SceneCollectionsServiceLoad", SceneCollectionsServiceLoad);
evntComServer.expose("SceneCollectionsServiceRename", SceneCollectionsServiceRename);

// Scenes

const ScenesServiceGetCurrent = async () => await request("ScenesService", "activeScene");
const ScenesServiceGetCurrentId = async () => await request("ScenesService", "activeSceneId");
const ScenesServiceCreate = async (name: string) => await request("ScenesService", "createScene", name);
const ScenesServiceGet = async (id: string) => await request("ScenesService", "getScene", id);
const ScenesServiceGetAll = async () => await request("ScenesService", "getScenes");
const ScenesServiceSwitch = async (id: string) => await request("ScenesService", "makeSceneActive", id);
const ScenesServiceRemove = async (id: string) => await request("ScenesService", "removeScene", id);


evntComServer.expose("ScenesServiceGetCurrent", ScenesServiceGetCurrent);
evntComServer.expose("ScenesServiceGetCurrentId", ScenesServiceGetCurrentId);
evntComServer.expose("ScenesServiceCreate", ScenesServiceCreate);
evntComServer.expose("ScenesServiceGet", ScenesServiceGet);
evntComServer.expose("ScenesServiceGetAll", ScenesServiceGetAll);
evntComServer.expose("ScenesServiceSwitch", ScenesServiceSwitch);
evntComServer.expose("ScenesServiceRemove", ScenesServiceRemove);

// SelectionService

const SelectionServiceGetSceneId = async () => await request("SelectionService", "sceneId")
const SelectionServiceAdd = async (ids: string[]) => await request("SelectionService", "add", ids);
const SelectionServiceCenterOnScreen = async () => await request("SelectionService", "centerOnScreen");
const SelectionServiceClone = async () => await request("SelectionService", "clone");
const SelectionServiceDeselect = async (ids: string[]) => await request("SelectionService", "deselect", ids)
const SelectionServiceFitToScreen = async () => await request("SelectionService", "fitToScreen");
const SelectionServiceFlipX = async () => await request("SelectionService", "flipX");
const SelectionServiceFlipY = async () => await request("SelectionService", "flipY");
const SelectionServiceGetBoundingRect = async () => await request("SelectionService", "getBoundingRect");
const SelectionServiceGetFolders = async () => await request("SelectionService", "getFolders");
const SelectionServiceGetIds = async () => await request("SelectionService", "getIds");
const SelectionServiceGetInverted = async () => await request("SelectionService", "getInverted");
const SelectionServiceGetInvertedIds = async () => await request("SelectionService", "getInvertedIds");
const SelectionServiceGetItems = async () => await request("SelectionService", "getItems");
const SelectionServiceGetLastSelected = async () => await request("SelectionService", "getLastSelected");
const SelectionServiceGetLastSelectedId = async () => await request("SelectionService", "getLastSelectedId");
const SelectionServiceGetModel = async () => await request("SelectionService", "getModel");
const SelectionServiceGetRootNodes = async () => await request("SelectionService", "getRootNodes");
const SelectionServiceGetScene = async () => await request("SelectionService", "getScene");
const SelectionServiceGetSize = async () => await request("SelectionService", "getSize");
const SelectionServiceGetSources = async () => await request("SelectionService", "getSources");
const SelectionServiceGetVisualItems = async () => await request("SelectionService", "getVisualItems");
const SelectionServiceInvert = async () => await request("SelectionService", "invert");
const SelectionServiceIsSceneFolder = async () => await request("SelectionService", "isSceneFolder");
const SelectionServiceIsSceneItem = async () => await request("SelectionService", "isSceneItem");
const SelectionServiceIsSelected = async () => await request("SelectionService", "isSelected");
const SelectionServiceMoveTo = async (sceneId: string, folderId?: string) => await request("SelectionService", "moveTo", sceneId, folderId);
const SelectionServicePlaceAfter = async (sceneNodeId: string) => await request("SelectionService", "placeAfter", sceneNodeId);
const SelectionServicePlaceBefore = async (sceneNodeId: string) => await request("SelectionService", "placeBefore", sceneNodeId);
const SelectionServiceRemove = async () => await request("SelectionService", "remove");
const SelectionServiceReset = async () => await request("SelectionService", "reset");
const SelectionServiceResetTransform = async () => await request("SelectionService", "resetTransform");
const SelectionServiceRotate = async (deg: number) => await request("SelectionService", "rotate", deg);
const SelectionServiceScale = async (scale: IVec2, origin?: IVec2) => await request("SelectionService", "scale", scale, origin);
const SelectionServiceScaleWithOffSet = async (scale: IVec2, offset: IVec2) => await request("SelectionService", "scaleWithOffset", scale, offset);
const SelectionServiceSelect = async (ids: string[]) => await request("SelectionService", "select", ids);
const SelectionServiceSelectAll = async () => await request("SelectionService", "selectAll");
const SelectionServiceSetContentCrop = async () => await request("SelectionService", "setContentCrop");
const SelectionServiceSetParent = async (folderId: string) => await request("SelectionService", "setParent", folderId);
const SelectionServiceSetRecordingVisible = async (recordingVisible: boolean) => await request("SelectionService", "setRecordingVisible", recordingVisible);
const SelectionServiceSetSettings = async (settings: Partial<ISceneItemSettings>) =>  await request("SelectionService", "setSettings", settings);
const SelectionServiceSetStreamVisible = async (streamVisible: boolean) => await request("SelectionService", "setStreamVisible", streamVisible);
const SelectionServiceSetTransform = async (transform: IPartialTransform) => await request("SelectionService", "setTransform", transform);
const SelectionServiceSetVisibility = async (visible: boolean) => await request("SelectionService", "setVisibility", visible);
const SelectionServiceStretchToScreen = async () => await request("SelectionService", "stretchToScreen");
const SelectionServiceCopyTo = async (sceneId: string, folderId?: string, duplicateSources?: boolean) => {
  return await request("SelectionService", "copyTo", sceneId, folderId, duplicateSources);
}


evntComServer.expose("SelectionServiceGetSceneId", SelectionServiceGetSceneId);
evntComServer.expose("SelectionServiceAdd", SelectionServiceAdd);
evntComServer.expose("SelectionServiceCenterOnScreen", SelectionServiceCenterOnScreen);
evntComServer.expose("SelectionServiceClone", SelectionServiceClone);
evntComServer.expose("SelectionServiceDeselect", SelectionServiceDeselect);
evntComServer.expose("SelectionServiceFitToScreen", SelectionServiceFitToScreen);
evntComServer.expose("SelectionServiceFlipX", SelectionServiceFlipX);
evntComServer.expose("SelectionServiceFlipY", SelectionServiceFlipY);
evntComServer.expose("SelectionServiceGetBoundingRect", SelectionServiceGetBoundingRect);
evntComServer.expose("SelectionServiceGetFolders", SelectionServiceGetFolders);
evntComServer.expose("SelectionServiceGetIds", SelectionServiceGetIds);
evntComServer.expose("SelectionServiceGetInverted", SelectionServiceGetInverted);
evntComServer.expose("SelectionServiceGetInvertedIds", SelectionServiceGetInvertedIds);
evntComServer.expose("SelectionServiceGetItems", SelectionServiceGetItems);
evntComServer.expose("SelectionServiceGetLastSelected", SelectionServiceGetLastSelected);
evntComServer.expose("SelectionServiceGetLastSelectedId", SelectionServiceGetLastSelectedId);
evntComServer.expose("SelectionServiceGetModel", SelectionServiceGetModel);
evntComServer.expose("SelectionServiceGetRootNodes", SelectionServiceGetRootNodes);

// SourcesService

const SourcesServiceAddFile = async (path: string) => await request("SourcesService", "addFile", path);

const SourcesServiceCreateSource = async (
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
}

const SourcesServiceGetAvailableSourcesTypesList = async () => {
  return await request("SourcesService", "getAvailableSourcesTypesList");
}

const SourcesServiceGet = async (sourceId: string) => {
  return await request("SourcesService", "getSource");
}

const SourcesServiceGetAll = async () => {
  return await request("SourcesService", "getSources");
}

const SourcesServiceGetByName = async (name: string) => {
  return await request("SourcesService", "getSourcesByName", name);
}

const SourcesServiceRemove = async (id: string) => {
  return await request("SourcesService", "removeSource", id);
}

const SourcesServiceShowAddSource = async (sourceType: TSourceType) => {
  return await request("SourcesService", "showAddSource", sourceType);
}

const SourcesServiceShowShowcase = async () => {
  return await request("SourcesService", "showShowcase");
}

const SourcesServiceShowSourceProperties = async (sourceId: string) => {
  return await request(
      "SourcesService",
      "showSourceProperties",
      sourceId
  );
}

// StreamingService

const StreamingServiceGetModel = async () => {
  return await request("StreamingService", "getModel");
}

const StreamingServiceSaveReplay = async () => {
  return await request("StreamingService", "saveReplay");
}

const StreamingServiceStartReplayBuffer = async () => {
  return await request("StreamingService", "startReplayBuffer");
}

const StreamingServiceStopReplayBuffer = async () => {
  return await request("StreamingService", "stopReplayBuffer");
}

const StreamingServiceToggleRecording = async () => {
  return await request("StreamingService", "toggleRecording");
}

const StreamingServiceToggleStreaming = async () => {
  return await request("StreamingService", "toggleStreaming");
}

// TransitionsService

const TransitionsServiceDisableStudioMode = async () => {
  return await request("TransitionsService", "disableStudioMode");
}

const TransitionsServiceEnableStudioMode = async () => {
  return await request("TransitionsService", "enableStudioMode");
}

const TransitionsServiceExecuteStudioModeTransition = async () => {
  return await request(
      "TransitionsService",
      "executeStudioModeTransition"
  );
}

const TransitionsServiceGetModel = async () => {
  return await request("TransitionsService", "getModel");
}

// AudioSource

const AudioSourceGetModel = async (resourceId: string) => {
  return await request(resourceId, "getModel");
}

const AudioSourceSetDeflection = async (resourceId: string, deflection: number) => {
  return await request(resourceId, "setDeflection", deflection);
}

const AudioSourceSetMuted = async (resourceId: string, muted: boolean) => {
  return await request(resourceId, "setMuted", muted);
}

// Scene

const SceneAddFile = async (resourceId: string, path: string, folderId?: string) => {
  return await request(resourceId, "addFile", path, folderId);
}

const SceneAddSource = async (
    resourceId: string,
    sourceId: string,
    options?: ISceneNodeAddOptions
) => {
  return await request(resourceId, "addSource", sourceId, options);
}

const SceneCanAddSource = async (resourceId: string, sourceId: string) => {
  return await request(resourceId, "canAddSource", sourceId);
}

const SceneClear = async (resourceId: string) => {
  return await request(resourceId, "clear");
}

const SceneCreateAndAddSource = async (
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
}

const SceneCreateFolder = async (resourceId: string, name: string) => {
  return await request(resourceId, "createFolder", name);
}

const SceneGetFolder = async (resourceId: string, sceneFolderId: string) => {
  return await request(resourceId, "getFolder", sceneFolderId);
}

const SceneGetFolders = async (resourceId: string) => {
  return await request(resourceId, "getFolders");
}

const SceneGetItem = async (resourceId: string, sceneItemId: string) => {
  return await request(resourceId, "getItem", sceneItemId);
}

const SceneGetItems = async (resourceId: string) => {
  return await request(resourceId, "getItems");
}

const SceneGetModel = async (resourceId: string) => {
  return await request(resourceId, "getModel");
}

const SceneGetNestedItems = async (resourceId: string) => {
  return await request(resourceId, "getNestedItems");
}

const SceneGetNestedScenes = async (resourceId: string) => {
  return await request(resourceId, "getNestedScenes");
}

const SceneGetNestedSources = async (resourceId: string) => {
  return await request(resourceId, "getNestedSources");
}

const SceneGetNode = async (resourceId: string, sceneNodeId: string) => {
  return await request(resourceId, "getNode", sceneNodeId);
}

const SceneGetNodeByName = async (resourceId: string, name: string) => {
  return await request(resourceId, "getNodeByName", name);
}

const SceneGetNodes = async (resourceId: string) => {
  return await request(resourceId, "getNodes");
}

const SceneGetRootNodes = async (resourceId: string) => {
  return await request(resourceId, "getRootNodes");
}

const SceneGetSelection = async (resourceId: string, ids?: string[]) => {
  return await request(resourceId, "getSelection", ids);
}

const SceneGetSource = async (resourceId: string) => {
  return await request(resourceId, "getSource");
}

const SceneMakeActive = async (resourceId: string) => {
  return await request(resourceId, "makeActive");
}

const SceneRemove = async (resourceId: string) => {
  return await request(resourceId, "remove");
}

const SceneRemoveFolder = async (resourceId: string, folderId: string) => {
  return await request(resourceId, "removeFolder", folderId);
}

const SceneRemoveItem = async (resourceId: string, sceneItemId: string) => {
  return await request(resourceId, "removeItem", sceneItemId);
}

const SceneSetName = async (resourceId: string, newName: string) => {
  return await request(resourceId, "setName", newName);
}

// SceneItem

const SceneItemAddToSelection = async (resourceId: string) => {
  return await request(resourceId, "addToSelection");
}

const SceneItemCenterOnScreen = async (resourceId: string) => {
  return await request(resourceId, "centerOnScreen");
}

const SceneItemDeselect = async (resourceId: string) => {
  return await request(resourceId, "deselect");
}

const SceneItemDetachParent = async (resourceId: string) => {
  return await request(resourceId, "detachParent");
}

const SceneItemFitToScreen = async (resourceId: string) => {
  return await request(resourceId, "fitToScreen");
}

const SceneItemFlipX = async (resourceId: string) => {
  return await request(resourceId, "flipX");
}

const SceneItemFlipY = async (resourceId: string) => {
  return await request(resourceId, "flipY");
}

const SceneItemGetItemIndex = async (resourceId: string) => {
  return await request(resourceId, "getItemIndex");
}

const SceneItemGetModel = async (resourceId: string) => {
  return await request(resourceId, "getModel");
}

const SceneItemGetNextItem = async (resourceId: string) => {
  return await request(resourceId, "getNextItem");
}

const SceneItemGetNextNode = async (resourceId: string) => {
  return await request(resourceId, "getNextNode");
}

const SceneItemGetNodeIndex = async (resourceId: string) => {
  return await request(resourceId, "getNodeIndex");
}

const SceneItemGetParent = async (resourceId: string) => {
  return await request(resourceId, "getParent");
}

const SceneItemGetPath = async (resourceId: string) => {
  return await request(resourceId, "getPath");
}

const SceneItemGetPrevItem = async (resourceId: string) => {
  return await request(resourceId, "getPrevItem");
}

const SceneItemGetPrevNode = async (resourceId: string) => {
  return await request(resourceId, "getPrevNode");
}

const SceneItemGetScene = async (resourceId: string) => {
  return await request(resourceId, "getScene");
}

const SceneItemGetSource = async (resourceId: string) => {
  return await request(resourceId, "getSource");
}

const SceneItemHasParent = async (resourceId: string) => {
  return await request(resourceId, "hasParent");
}

const SceneItemIsFolder = async (resourceId: string) => {
  return await request(resourceId, "isFolder");
}

const SceneItemIsItem = async (resourceId: string) => {
  return await request(resourceId, "isItem");
}

const SceneItemIsSelected = async (resourceId: string) => {
  return await request(resourceId, "isSelected");
}

const SceneItemPlaceAfter = async (resourceId: string, nodeId: string) => {
  return await request(resourceId, "placeAfter", nodeId);
}

const SceneItemPlaceBefore = async (resourceId: string, nodeId: string) => {
  return await request(resourceId, "placeBefore", nodeId);
}

const SceneItemRemove = async (resourceId: string) => {
  return await request(resourceId, "remove");
}

const SceneItemResetTransform = async (resourceId: string) => {
  return await request(resourceId, "resetTransform");
}

const SceneItemRotate = async (resourceId: string, deg: number) => {
  return await request(resourceId, "rotate", deg);
}

const SceneItemSelect = async (resourceId: string) => {
  return await request(resourceId, "select");
}

const SceneItemSetContentCrop = async (resourceId: string) => {
  return await request(resourceId, "setContentCrop");
}

const SceneItemSetParent = async (resourceId: string, parentId: string) => {
  return await request(resourceId, "setParent", parentId);
}

const SceneItemSetScale = async (
    resourceId: string,
    newScaleModel: IVec2,
    origin?: IVec2
) => {
  return await request(resourceId, "setScale", newScaleModel, origin);
}

const SceneItemSetSettings = async (
    resourceId: string,
    settings: Partial<ISceneItemSettings>
) => {
  return await request(resourceId, "setSettings", settings);
}

const SceneItemSetTransform = async (
    resourceId: string,
    transform: IPartialTransform
) => {
  return await request(resourceId, "setTransform", transform);
}

const SceneItemSetVisibility = async (resourceId: string, visible: boolean) => {
  return await request(resourceId, "setVisibility", visible);
}

const SceneItemStretchToScreen = async (resourceId: string) => {
  return await request(resourceId, "stretchToScreen");
}

// Source

const SourceDuplicate = async (resourceId: string) => {
  return await request(resourceId, "duplicate");
}

const SourceGetModel = async (resourceId: string) => {
  return await request(resourceId, "getModel");
}

const SourceGetProperties = async (resourceId: string) => {
  return await request(resourceId, "getPropertiesFormData");
}

const SourceGetSettings = async (resourceId: string) => {
  return await request(resourceId, "getSettings");
}

const SourceHasProps = async (resourceId: string) => {
  return await request(resourceId, "hasProps");
}

const SourceRefresh = async (resourceId: string) => {
  return await request(resourceId, "refresh");
}

const SourceSetName = async (resourceId: string, newName: string) => {
  return await request(resourceId, "setName");
}

const SourceSetProperties = async (resourceId: string) => {
  return await request(resourceId, "setPropertiesFormData");
}
