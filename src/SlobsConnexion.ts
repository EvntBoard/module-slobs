import { EvntComNode } from "evntcom-js/dist/node";
import { IConfigItem } from "./ConfigLoader";
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

export class SlobsConnexion {
  private evntCom: EvntComNode;
  private config: IConfigItem;

  private attemps: number = 0;
  private connectionStatus: string = "disconnected";
  private nextRequestId: number = 1;
  private requests: { [index: string]: any } = {};
  private subscriptions: { [index: string]: any } = {};
  private socket: any = null;

  constructor(
    evntBoardHost: string,
    evntBoardPort: number,
    config: IConfigItem
  ) {
    this.config = config;
    this.evntCom = new EvntComNode({
      name: config.name,
      port: evntBoardPort,
      host: evntBoardHost,
      events: [ESlobsEvent.OPEN, ESlobsEvent.CLOSE],
    });

    this.evntCom.onEvent = (data: any): void => {
      if (data?.emitter !== config.name) return;
      switch (data?.event) {
        case ESlobsEvent.OPEN:
          this.attemps = 0;
          break;
        case ESlobsEvent.CLOSE:
          this.tryReconnect();
          break;
        default:
          break;
      }
    };

    this.evntCom.onOpen = this.load.bind(this);

    const methods: { [index: string]: any } = {
      // AudioService

      AudioServiceGetSource: async (sourceId: string) =>
        await this.request("AudioService", "getSource", sourceId),
      AudioServiceGetSources: async () =>
        await this.request("AudioService", "getSources"),
      AudioServiceGetSourcesForCurrentScene: async () =>
        await this.request("AudioService", "getSourcesForCurrentScene"),
      AudioServiceGetSourcesForScene: async (sceneId: string) =>
        await this.request("AudioService", "getSourcesForScene", sceneId),

      // NotificationsService

      NotificationsServiceApplyAction: async (notificationId: number) =>
        await this.request(
          "NotificationsService",
          "applyAction",
          notificationId
        ),
      NotificationsServiceGetAll: async (type: ENotificationType) =>
        await this.request("NotificationsService", "getAll", type),
      NotificationsServiceGetNotification: async (id: number) =>
        await this.request("NotificationsService", "getNotification", id),
      NotificationsServiceGetRead: async (type: ENotificationType) =>
        await this.request("NotificationsService", "getRead", type),
      NotificationsServiceGetSettings: async () =>
        await this.request("NotificationsService", "getSettings"),
      NotificationsServiceGetUnread: async (type: ENotificationType) =>
        await this.request("NotificationsService", "getUnread", type),
      NotificationsServiceMarkAllAsRead: async () =>
        await this.request("NotificationsService", "markAllAsRead"),
      NotificationsServiceMarkAsRead: async (id: number) =>
        await this.request("NotificationsService", "markAsRead", id),
      NotificationsServicePush: async (notifyInfo: INotificationOptions) =>
        await this.request("NotificationsService", "push", notifyInfo),
      NotificationsServiceRestoreDefaultSettings: async () =>
        await this.request("NotificationsService", "restoreDefaultSettings"),
      NotificationsServiceSetSettings: async (
        patch: Partial<INotificationsSettings>
      ) => await this.request("NotificationsService", "setSettings", patch),
      NotificationsServiceShowNotifications: async () =>
        await this.request("NotificationsService", "showNotifications"),

      // PerformanceService

      PerformanceServiceGet: async () =>
        await this.request("PerformanceService", "getModel"),

      // SceneCollectionsService

      SceneCollectionsServiceGetActiveCollection: async () =>
        await this.request("SceneCollectionsService", "activeCollection"),
      SceneCollectionsServiceGetCollections: async () =>
        await this.request("SceneCollectionsService", "collections"),
      SceneCollectionsServiceCreate: async (options: { name: string }) =>
        await this.request("SceneCollectionsService", "create", options),
      SceneCollectionsServiceDelete: async (id?: string) =>
        await this.request("SceneCollectionsService", "delete", id),
      SceneCollectionsServiceFetchSchema: async () =>
        await this.request(
          "SceneCollectionsService",
          "fetchSceneCollectionsSchema"
        ),
      SceneCollectionsServiceLoad: async (id: string) =>
        await this.request("SceneCollectionsService", "load", id),
      SceneCollectionsServiceRename: async (id: string, newName: string) =>
        await this.request("SceneCollectionsService", "rename", newName, id),

      // Scenes

      ScenesServiceGetCurrent: async () =>
        await this.request("ScenesService", "activeScene"),
      ScenesServiceGetCurrentId: async () =>
        await this.request("ScenesService", "activeSceneId"),
      ScenesServiceCreate: async (name: string) =>
        await this.request("ScenesService", "createScene", name),
      ScenesServiceGet: async (id: string) =>
        await this.request("ScenesService", "getScene", id),
      ScenesServiceGetAll: async () =>
        await this.request("ScenesService", "getScenes"),
      ScenesServiceSwitch: async (id: string) =>
        await this.request("ScenesService", "makeSceneActive", id),
      ScenesServiceRemove: async (id: string) =>
        await this.request("ScenesService", "removeScene", id),

      // SelectionService

      SelectionServiceGetSceneId: async () =>
        await this.request("SelectionService", "sceneId"),
      SelectionServiceAdd: async (ids: string[]) =>
        await this.request("SelectionService", "add", ids),
      SelectionServiceCenterOnScreen: async () =>
        await this.request("SelectionService", "centerOnScreen"),
      SelectionServiceClone: async () =>
        await this.request("SelectionService", "clone"),
      SelectionServiceDeselect: async (ids: string[]) =>
        await this.request("SelectionService", "deselect", ids),
      SelectionServiceFitToScreen: async () =>
        await this.request("SelectionService", "fitToScreen"),
      SelectionServiceFlipX: async () =>
        await this.request("SelectionService", "flipX"),
      SelectionServiceFlipY: async () =>
        await this.request("SelectionService", "flipY"),
      SelectionServiceGetBoundingRect: async () =>
        await this.request("SelectionService", "getBoundingRect"),
      SelectionServiceGetFolders: async () =>
        await this.request("SelectionService", "getFolders"),
      SelectionServiceGetIds: async () =>
        await this.request("SelectionService", "getIds"),
      SelectionServiceGetInverted: async () =>
        await this.request("SelectionService", "getInverted"),
      SelectionServiceGetInvertedIds: async () =>
        await this.request("SelectionService", "getInvertedIds"),
      SelectionServiceGetItems: async () =>
        await this.request("SelectionService", "getItems"),
      SelectionServiceGetLastSelected: async () =>
        await this.request("SelectionService", "getLastSelected"),
      SelectionServiceGetLastSelectedId: async () =>
        await this.request("SelectionService", "getLastSelectedId"),
      SelectionServiceGetModel: async () =>
        await this.request("SelectionService", "getModel"),
      SelectionServiceGetRootNodes: async () =>
        await this.request("SelectionService", "getRootNodes"),
      SelectionServiceGetScene: async () =>
        await this.request("SelectionService", "getScene"),
      SelectionServiceGetSize: async () =>
        await this.request("SelectionService", "getSize"),
      SelectionServiceGetSources: async () =>
        await this.request("SelectionService", "getSources"),
      SelectionServiceGetVisualItems: async () =>
        await this.request("SelectionService", "getVisualItems"),
      SelectionServiceInvert: async () =>
        await this.request("SelectionService", "invert"),
      SelectionServiceIsSceneFolder: async () =>
        await this.request("SelectionService", "isSceneFolder"),
      SelectionServiceIsSceneItem: async () =>
        await this.request("SelectionService", "isSceneItem"),
      SelectionServiceIsSelected: async () =>
        await this.request("SelectionService", "isSelected"),
      SelectionServiceMoveTo: async (sceneId: string, folderId?: string) =>
        await this.request("SelectionService", "moveTo", sceneId, folderId),
      SelectionServicePlaceAfter: async (sceneNodeId: string) =>
        await this.request("SelectionService", "placeAfter", sceneNodeId),
      SelectionServicePlaceBefore: async (sceneNodeId: string) =>
        await this.request("SelectionService", "placeBefore", sceneNodeId),
      SelectionServiceRemove: async () =>
        await this.request("SelectionService", "remove"),
      SelectionServiceReset: async () =>
        await this.request("SelectionService", "reset"),
      SelectionServiceResetTransform: async () =>
        await this.request("SelectionService", "resetTransform"),
      SelectionServiceRotate: async (deg: number) =>
        await this.request("SelectionService", "rotate", deg),
      SelectionServiceScale: async (scale: IVec2, origin?: IVec2) =>
        await this.request("SelectionService", "scale", scale, origin),
      SelectionServiceScaleWithOffSet: async (scale: IVec2, offset: IVec2) =>
        await this.request(
          "SelectionService",
          "scaleWithOffset",
          scale,
          offset
        ),
      SelectionServiceSelect: async (ids: string[]) =>
        await this.request("SelectionService", "select", ids),
      SelectionServiceSelectAll: async () =>
        await this.request("SelectionService", "selectAll"),
      SelectionServiceSetContentCrop: async () =>
        await this.request("SelectionService", "setContentCrop"),
      SelectionServiceSetParent: async (folderId: string) =>
        await this.request("SelectionService", "setParent", folderId),
      SelectionServiceSetRecordingVisible: async (recordingVisible: boolean) =>
        await this.request(
          "SelectionService",
          "setRecordingVisible",
          recordingVisible
        ),
      SelectionServiceSetSettings: async (
        settings: Partial<ISceneItemSettings>
      ) => await this.request("SelectionService", "setSettings", settings),
      SelectionServiceSetStreamVisible: async (streamVisible: boolean) =>
        await this.request(
          "SelectionService",
          "setStreamVisible",
          streamVisible
        ),
      SelectionServiceSetTransform: async (transform: IPartialTransform) =>
        await this.request("SelectionService", "setTransform", transform),
      SelectionServiceSetVisibility: async (visible: boolean) =>
        await this.request("SelectionService", "setVisibility", visible),
      SelectionServiceStretchToScreen: async () =>
        await this.request("SelectionService", "stretchToScreen"),
      SelectionServiceCopyTo: async (
        sceneId: string,
        folderId?: string,
        duplicateSources?: boolean
      ) => {
        return await this.request(
          "SelectionService",
          "copyTo",
          sceneId,
          folderId,
          duplicateSources
        );
      },

      // SourcesService

      SourcesServiceAddFile: async (path: string) =>
        await this.request("SourcesService", "addFile", path),

      SourcesServiceCreateSource: async (
        name: string,
        type: TSourceType,
        settings?: Dictionary<any>,
        options?: ISourceAddOptions
      ) => {
        return await this.request(
          "SourcesService",
          "createSource",
          name,
          type,
          settings,
          options
        );
      },

      SourcesServiceGetAvailableSourcesTypesList: async () => {
        return await this.request(
          "SourcesService",
          "getAvailableSourcesTypesList"
        );
      },

      SourcesServiceGet: async (sourceId: string) => {
        return await this.request("SourcesService", "getSource");
      },

      SourcesServiceGetAll: async () => {
        return await this.request("SourcesService", "getSources");
      },

      SourcesServiceGetByName: async (name: string) => {
        return await this.request("SourcesService", "getSourcesByName", name);
      },

      SourcesServiceRemove: async (id: string) => {
        return await this.request("SourcesService", "removeSource", id);
      },

      SourcesServiceShowAddSource: async (sourceType: TSourceType) => {
        return await this.request(
          "SourcesService",
          "showAddSource",
          sourceType
        );
      },

      SourcesServiceShowShowcase: async () => {
        return await this.request("SourcesService", "showShowcase");
      },

      SourcesServiceShowSourceProperties: async (sourceId: string) => {
        return await this.request(
          "SourcesService",
          "showSourceProperties",
          sourceId
        );
      },

      // StreamingService

      StreamingServiceGetModel: async () => {
        return await this.request("StreamingService", "getModel");
      },

      StreamingServiceSaveReplay: async () => {
        return await this.request("StreamingService", "saveReplay");
      },

      StreamingServiceStartReplayBuffer: async () => {
        return await this.request("StreamingService", "startReplayBuffer");
      },

      StreamingServiceStopReplayBuffer: async () => {
        return await this.request("StreamingService", "stopReplayBuffer");
      },

      StreamingServiceToggleRecording: async () => {
        return await this.request("StreamingService", "toggleRecording");
      },

      StreamingServiceToggleStreaming: async () => {
        return await this.request("StreamingService", "toggleStreaming");
      },

      // TransitionsService

      TransitionsServiceDisableStudioMode: async () => {
        return await this.request("TransitionsService", "disableStudioMode");
      },

      TransitionsServiceEnableStudioMode: async () => {
        return await this.request("TransitionsService", "enableStudioMode");
      },

      TransitionsServiceExecuteStudioModeTransition: async () => {
        return await this.request(
          "TransitionsService",
          "executeStudioModeTransition"
        );
      },

      TransitionsServiceGetModel: async () => {
        return await this.request("TransitionsService", "getModel");
      },

      // AudioSource

      AudioSourceGetModel: async (resourceId: string) => {
        return await this.request(resourceId, "getModel");
      },

      AudioSourceSetDeflection: async (
        resourceId: string,
        deflection: number
      ) => {
        return await this.request(resourceId, "setDeflection", deflection);
      },

      AudioSourceSetMuted: async (resourceId: string, muted: boolean) => {
        return await this.request(resourceId, "setMuted", muted);
      },

      // Scene

      SceneAddFile: async (
        resourceId: string,
        path: string,
        folderId?: string
      ) => {
        return await this.request(resourceId, "addFile", path, folderId);
      },

      SceneAddSource: async (
        resourceId: string,
        sourceId: string,
        options?: ISceneNodeAddOptions
      ) => {
        return await this.request(resourceId, "addSource", sourceId, options);
      },

      SceneCanAddSource: async (resourceId: string, sourceId: string) => {
        return await this.request(resourceId, "canAddSource", sourceId);
      },

      SceneClear: async (resourceId: string) => {
        return await this.request(resourceId, "clear");
      },

      SceneCreateAndAddSource: async (
        resourceId: string,
        name: string,
        type: TSourceType,
        settings?: Dictionary<any>
      ) => {
        return await this.request(
          resourceId,
          "createAndAddSource",
          name,
          type,
          settings
        );
      },

      SceneCreateFolder: async (resourceId: string, name: string) => {
        return await this.request(resourceId, "createFolder", name);
      },

      SceneGetFolder: async (resourceId: string, sceneFolderId: string) => {
        return await this.request(resourceId, "getFolder", sceneFolderId);
      },

      SceneGetFolders: async (resourceId: string) => {
        return await this.request(resourceId, "getFolders");
      },

      SceneGetItem: async (resourceId: string, sceneItemId: string) => {
        return await this.request(resourceId, "getItem", sceneItemId);
      },

      SceneGetItems: async (resourceId: string) => {
        return await this.request(resourceId, "getItems");
      },

      SceneGetModel: async (resourceId: string) => {
        return await this.request(resourceId, "getModel");
      },

      SceneGetNestedItems: async (resourceId: string) => {
        return await this.request(resourceId, "getNestedItems");
      },

      SceneGetNestedScenes: async (resourceId: string) => {
        return await this.request(resourceId, "getNestedScenes");
      },

      SceneGetNestedSources: async (resourceId: string) => {
        return await this.request(resourceId, "getNestedSources");
      },

      SceneGetNode: async (resourceId: string, sceneNodeId: string) => {
        return await this.request(resourceId, "getNode", sceneNodeId);
      },

      SceneGetNodeByName: async (resourceId: string, name: string) => {
        return await this.request(resourceId, "getNodeByName", name);
      },

      SceneGetNodes: async (resourceId: string) => {
        return await this.request(resourceId, "getNodes");
      },

      SceneGetRootNodes: async (resourceId: string) => {
        return await this.request(resourceId, "getRootNodes");
      },

      SceneGetSelection: async (resourceId: string, ids?: string[]) => {
        return await this.request(resourceId, "getSelection", ids);
      },

      SceneGetSource: async (resourceId: string) => {
        return await this.request(resourceId, "getSource");
      },

      SceneMakeActive: async (resourceId: string) => {
        return await this.request(resourceId, "makeActive");
      },

      SceneRemove: async (resourceId: string) => {
        return await this.request(resourceId, "remove");
      },

      SceneRemoveFolder: async (resourceId: string, folderId: string) => {
        return await this.request(resourceId, "removeFolder", folderId);
      },

      SceneRemoveItem: async (resourceId: string, sceneItemId: string) => {
        return await this.request(resourceId, "removeItem", sceneItemId);
      },

      SceneSetName: async (resourceId: string, newName: string) => {
        return await this.request(resourceId, "setName", newName);
      },

      // SceneItem

      SceneItemAddToSelection: async (resourceId: string) => {
        return await this.request(resourceId, "addToSelection");
      },

      SceneItemCenterOnScreen: async (resourceId: string) => {
        return await this.request(resourceId, "centerOnScreen");
      },

      SceneItemDeselect: async (resourceId: string) => {
        return await this.request(resourceId, "deselect");
      },

      SceneItemDetachParent: async (resourceId: string) => {
        return await this.request(resourceId, "detachParent");
      },

      SceneItemFitToScreen: async (resourceId: string) => {
        return await this.request(resourceId, "fitToScreen");
      },

      SceneItemFlipX: async (resourceId: string) => {
        return await this.request(resourceId, "flipX");
      },

      SceneItemFlipY: async (resourceId: string) => {
        return await this.request(resourceId, "flipY");
      },

      SceneItemGetItemIndex: async (resourceId: string) => {
        return await this.request(resourceId, "getItemIndex");
      },

      SceneItemGetModel: async (resourceId: string) => {
        return await this.request(resourceId, "getModel");
      },

      SceneItemGetNextItem: async (resourceId: string) => {
        return await this.request(resourceId, "getNextItem");
      },

      SceneItemGetNextNode: async (resourceId: string) => {
        return await this.request(resourceId, "getNextNode");
      },

      SceneItemGetNodeIndex: async (resourceId: string) => {
        return await this.request(resourceId, "getNodeIndex");
      },

      SceneItemGetParent: async (resourceId: string) => {
        return await this.request(resourceId, "getParent");
      },

      SceneItemGetPath: async (resourceId: string) => {
        return await this.request(resourceId, "getPath");
      },

      SceneItemGetPrevItem: async (resourceId: string) => {
        return await this.request(resourceId, "getPrevItem");
      },

      SceneItemGetPrevNode: async (resourceId: string) => {
        return await this.request(resourceId, "getPrevNode");
      },

      SceneItemGetScene: async (resourceId: string) => {
        return await this.request(resourceId, "getScene");
      },

      SceneItemGetSource: async (resourceId: string) => {
        return await this.request(resourceId, "getSource");
      },

      SceneItemHasParent: async (resourceId: string) => {
        return await this.request(resourceId, "hasParent");
      },

      SceneItemIsFolder: async (resourceId: string) => {
        return await this.request(resourceId, "isFolder");
      },

      SceneItemIsItem: async (resourceId: string) => {
        return await this.request(resourceId, "isItem");
      },

      SceneItemIsSelected: async (resourceId: string) => {
        return await this.request(resourceId, "isSelected");
      },

      SceneItemPlaceAfter: async (resourceId: string, nodeId: string) => {
        return await this.request(resourceId, "placeAfter", nodeId);
      },

      SceneItemPlaceBefore: async (resourceId: string, nodeId: string) => {
        return await this.request(resourceId, "placeBefore", nodeId);
      },

      SceneItemRemove: async (resourceId: string) => {
        return await this.request(resourceId, "remove");
      },

      SceneItemResetTransform: async (resourceId: string) => {
        return await this.request(resourceId, "resetTransform");
      },

      SceneItemRotate: async (resourceId: string, deg: number) => {
        return await this.request(resourceId, "rotate", deg);
      },

      SceneItemSelect: async (resourceId: string) => {
        return await this.request(resourceId, "select");
      },

      SceneItemSetContentCrop: async (resourceId: string) => {
        return await this.request(resourceId, "setContentCrop");
      },

      SceneItemSetParent: async (resourceId: string, parentId: string) => {
        return await this.request(resourceId, "setParent", parentId);
      },

      SceneItemSetScale: async (
        resourceId: string,
        newScaleModel: IVec2,
        origin?: IVec2
      ) => {
        return await this.request(
          resourceId,
          "setScale",
          newScaleModel,
          origin
        );
      },

      SceneItemSetSettings: async (
        resourceId: string,
        settings: Partial<ISceneItemSettings>
      ) => {
        return await this.request(resourceId, "setSettings", settings);
      },

      SceneItemSetTransform: async (
        resourceId: string,
        transform: IPartialTransform
      ) => {
        return await this.request(resourceId, "setTransform", transform);
      },

      SceneItemSetVisibility: async (resourceId: string, visible: boolean) => {
        return await this.request(resourceId, "setVisibility", visible);
      },

      SceneItemStretchToScreen: async (resourceId: string) => {
        return await this.request(resourceId, "stretchToScreen");
      },

      // Source

      SourceDuplicate: async (resourceId: string) => {
        return await this.request(resourceId, "duplicate");
      },

      SourceGetModel: async (resourceId: string) => {
        return await this.request(resourceId, "getModel");
      },

      SourceGetProperties: async (resourceId: string) => {
        return await this.request(resourceId, "getPropertiesFormData");
      },

      SourceGetSettings: async (resourceId: string) => {
        return await this.request(resourceId, "getSettings");
      },

      SourceHasProps: async (resourceId: string) => {
        return await this.request(resourceId, "hasProps");
      },

      SourceRefresh: async (resourceId: string) => {
        return await this.request(resourceId, "refresh");
      },

      SourceSetName: async (resourceId: string, newName: string) => {
        return await this.request(resourceId, "setName");
      },

      SourceSetProperties: async (resourceId: string) => {
        return await this.request(resourceId, "setPropertiesFormData");
      },
    };

    for (let key in methods) {
      this.evntCom.expose(key, methods[key]);
    }
  }

  load = async () => {
    await this.evntCom.notify("newEvent", [
      ESlobsEvent.LOAD,
      null,
      { emitter: this.config.name },
    ]);

    if (this.connectionStatus !== "disconnected") return;
    this.connectionStatus = "pending";
    this.socket = new SockJS(
      `http://${this.config.host}:${this.config.port}/api`
    );

    this.socket.onopen = () => {
      // send token for auth
      this.request("TcpServerService", "auth", this.config.token)
        .then(this.onConnectionHandler)
        .catch((e: Error) => {
          console.log(e.message);
        });
    };

    this.socket.onmessage = (e: any) => {
      this.onMessageHandler(e.data);
    };

    this.socket.onclose = (e: any) => {
      this.connectionStatus = "disconnected";
      console.log("disconnected: " + e.reason);
      this.evntCom.notify("newEvent", [ESlobsEvent.CLOSE, e]);
    };
  };

  tryReconnect = () => {
    this.attemps += 1;
    console.log(`Attempt to reconnect SLOBS for the ${this.attemps} time(s)`);
    const waintingTime = this.attemps * 5000;
    setTimeout(async () => await this.load(), waintingTime);
  };

  private request = (
    resourceId: string,
    methodName: string,
    ...args: any[]
  ): any => {
    let id = this.nextRequestId++;
    let requestBody = {
      jsonrpc: "2.0",
      id,
      method: methodName,
      params: { resource: resourceId, args },
    };

    return this.sendMessage(requestBody);
  };

  private sendMessage = (message: any) => {
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
      this.requests[requestBody.id] = {
        body: requestBody,
        resolve,
        reject,
        completed: false,
      };
      this.socket.send(JSON.stringify(requestBody));
    });
  };

  private onMessageHandler = (data: any) => {
    let message = JSON.parse(data);
    let request = this.requests[message.id];

    if (request) {
      if (message.error) {
        request.reject(message.error);
      } else {
        request.resolve(message.result);
      }
      delete this.requests[message.id];
    }

    const result = message.result;
    if (!result) return;

    if (result._type === "EVENT" && result.emitter === "STREAM") {
      this.subscriptions[message.result.resourceId](result.data);
    }
  };

  private subscribe = (resourceId: string, channelName: string, cb: any) => {
    this.request(resourceId, channelName).then(
      (subscriptionInfo: { resourceId: string | number }) => {
        this.subscriptions[subscriptionInfo.resourceId] = cb;
      }
    );
  };

  private onConnectionHandler = () => {
    this.connectionStatus = "connected";
    this.evntCom.callMethod("newEvent", [
      ESlobsEvent.OPEN,
      null,
      { emitter: this.config.name },
    ]);

    // SceneCollectionsService

    this.subscribe("SceneCollectionsService", "collectionAdded", (data: any) =>
      this.evntCom.callMethod("newEvent", [
        ESlobsEvent.COLLECTION_ADDED,
        data,
        { emitter: this.config.name },
      ])
    );

    this.subscribe(
      "SceneCollectionsService",
      "collectionRemoved",
      (data: any) =>
        this.evntCom.callMethod("newEvent", [
          ESlobsEvent.COLLECTION_REMOVED,
          data,
          { emitter: this.config.name },
        ])
    );

    this.subscribe(
      "SceneCollectionsService",
      "collectionSwitched",
      (data: any) =>
        this.evntCom.callMethod("newEvent", [
          ESlobsEvent.COLLECTION_SWITCHED,
          data,
          { emitter: this.config.name },
        ])
    );

    this.subscribe(
      "SceneCollectionsService",
      "collectionUpdated",
      (data: any) =>
        this.evntCom.callMethod("newEvent", [
          ESlobsEvent.COLLECTION_UPDATED,
          data,
          { emitter: this.config.name },
        ])
    );

    this.subscribe(
      "SceneCollectionsService",
      "collectionWillSwitch",
      (data: any) =>
        this.evntCom.callMethod("newEvent", [
          ESlobsEvent.COLLECTION_WILLSWITCH,
          data,
          { emitter: this.config.name },
        ])
    );

    // ScenesService

    this.subscribe("ScenesService", "itemAdded", (data: any) =>
      this.evntCom.callMethod("newEvent", [
        ESlobsEvent.ITEM_ADDED,
        data,
        { emitter: this.config.name },
      ])
    );

    this.subscribe("ScenesService", "itemRemoved", (data: any) =>
      this.evntCom.callMethod("newEvent", [
        ESlobsEvent.ITEM_REMOVED,
        data,
        { emitter: this.config.name },
      ])
    );

    this.subscribe("ScenesService", "itemUpdated", (data: any) =>
      this.evntCom.callMethod("newEvent", [
        ESlobsEvent.ITEM_UPDATED,
        data,
        { emitter: this.config.name },
      ])
    );

    this.subscribe("ScenesService", "sceneAdded", (data: any) =>
      this.evntCom.callMethod("newEvent", [
        ESlobsEvent.SCENE_ADDED,
        data,
        { emitter: this.config.name },
      ])
    );

    this.subscribe("ScenesService", "sceneRemoved", (data: any) =>
      this.evntCom.callMethod("newEvent", [
        ESlobsEvent.SCENE_REMOVED,
        data,
        { emitter: this.config.name },
      ])
    );

    this.subscribe("ScenesService", "sceneSwitched", (data: any) =>
      this.evntCom.callMethod("newEvent", [
        ESlobsEvent.SCENE_SWITCHED,
        data,
        { emitter: this.config.name },
      ])
    );

    // Sources

    this.subscribe("SourcesService", "sourceAdded", (data: any) =>
      this.evntCom.callMethod("newEvent", [
        ESlobsEvent.SOURCE_ADDED,
        data,
        { emitter: this.config.name },
      ])
    );

    this.subscribe("SourcesService", "sourceRemoved", (data: any) =>
      this.evntCom.callMethod("newEvent", [
        ESlobsEvent.SOURCE_REMOVED,
        data,
        { emitter: this.config.name },
      ])
    );

    this.subscribe("SourcesService", "sourceUpdated", (data: any) =>
      this.evntCom.callMethod("newEvent", [
        ESlobsEvent.SOURCE_UPDATED,
        data,
        { emitter: this.config.name },
      ])
    );

    // streaming

    this.subscribe("StreamingService", "recordingStatusChange", (data: any) =>
      this.evntCom.callMethod("newEvent", [
        ESlobsEvent.RECORDING_STATUS_CHANGED,
        data,
        { emitter: this.config.name },
      ])
    );

    this.subscribe(
      "StreamingService",
      "replayBufferStatusChange",
      (data: any) =>
        this.evntCom.callMethod("newEvent", [
          ESlobsEvent.REPLAY_STATUS_CHANGED,
          data,
          { emitter: this.config.name },
        ])
    );

    this.subscribe("StreamingService", "streamingStatusChange", (data: any) =>
      this.evntCom.callMethod("newEvent", [
        ESlobsEvent.STREAMING_STATUS_CHANGED,
        data,
        { emitter: this.config.name },
      ])
    );

    // Transitions

    this.subscribe("TransitionsService", "studioModeChanged", (data: any) =>
      this.evntCom.callMethod("newEvent", [
        ESlobsEvent.STUDIOMODE_STATUS_CHANGED,
        data,
        { emitter: this.config.name },
      ])
    );
  };
}
