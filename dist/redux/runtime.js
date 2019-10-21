"use strict";
exports.__esModule = true;
exports["default"] = "\nimport { IAction, IEnhancerProps, IStore, IRequestParams, StoreEnhancer, StoreCreator, Reducer, AnyAction } from './types'\n\nexport const RAP_REDUX_REQUEST = '$$_RAP_REDUX_REQUEST'\nexport const RAP_REDUX_UPDATE_STORE = '$$_RAP_REDUX_UPDATE_STORE'\nexport const RAP_REDUX_CLEAR_STORE = '$$_RAP_REDUX_CLEAR_STORE'\nexport const RAP_STATE_KEY = '$$rapResponseData'\n\n/** \u62FC\u63A5\u7EC4\u5408request\u94FE\u63A5 */\nconst getEndpoint = (requestPrefix: string, url: string): string => {\n    if (!requestPrefix) {\n        requestPrefix = ''\n    }\n    requestPrefix = requestPrefix.replace(/\\/$/, '')\n    url = url.replace(/^\\//, '')\n    return requestPrefix + '/' + url\n}\n\n/**\n * search \u53C2\u6570\u8F6C\u6362\uFF0C\u6BD4\u5982 { a: 1, b: 2, c: undefined } \u8F6C\u6362\u6210 \"a=1&b=2\"\n * \u4F1A\u81EA\u52A8\u5220\u9664 undefined\n */\nfunction locationStringify(\n    obj: {\n        [key: string]: any\n    } = {}\n): string {\n    return Object.entries(obj).reduce((str, [key, value]) => {\n        if (value === undefined) {\n            return str\n        }\n        str = str ? str + '&' : str\n        return str + key + '=' + value\n    }, '')\n}\n\nconst sendRequest = async (params: IRequestParams): Promise<any> => {\n    let requestUrl = params.endpoint\n    const requestParams: any = {\n        credentials: 'include',\n        method: params.method || 'GET',\n        headers: { 'Content-Type': 'application/json' },\n    }\n\n    if (requestParams.method === 'GET') {\n        requestUrl = requestUrl + '?' + locationStringify(params.params)\n    } else if (params.params) {\n        requestParams.body = JSON.stringify(params.params)\n    }\n    const res = await fetch(requestUrl, requestParams)\n    const retJSON = res.clone() // clone before return\n    return retJSON.json()\n}\n\nlet dispatch = (action: IAction): Promise<any> => {\n    return new Promise(() => { })\n}\n\ninterface IAssignDataProps {\n    /** \u5408\u5E76\u524D\u7684State */\n    oldState: object\n    /** \u6700\u5927\u7F13\u5B58\u6570 */\n    maxCacheLength?: number\n    payload: {\n        /** \u63A5\u53E3\u7684key */\n        interfaceKey: string\n        /** \u8BF7\u6C42\u7684\u552F\u4E00id\uFF0C\u6682\u65F6\u7B49\u4E8ErequestTime */\n        id: number\n        /** \u8BF7\u6C42\u65F6\u95F4\uFF0C\u540C\u65F6\u4E5F\u53EF\u4F5C\u4E3A\u672C\u6B21\u8BF7\u6C42\u7684key */\n        requestTime: number\n        /** \u54CD\u5E94\u65F6\u95F4 */\n        reponseTime?: number\n        /** \u8BF7\u6C42\u53C2\u6570*/\n        request?: any\n        /** \u8BF7\u6C42\u54CD\u5E94\u6570\u636E */\n        response?: any\n        /** \u662F\u5426\u6B63\u5728 fetching */\n        isFetching: boolean\n    }\n}\ninterface IStateInterfaceItem {\n    id: number\n    requestTime: number\n    request?: any\n    isFetching: boolean\n    reponseTime?: number\n    response?: any\n}\nfunction assignData({\n    oldState,\n    payload: { interfaceKey, id, requestTime, reponseTime, request = {}, response, isFetching },\n    maxCacheLength,\n}: IAssignDataProps) {\n    let newState = { ...oldState }\n    if (typeof maxCacheLength !== 'number' || maxCacheLength < 1) {\n        maxCacheLength = 2\n    }\n\n    let data = newState[interfaceKey] || []\n    if (isFetching === true) {\n        /** \u53EA\u5B58\u6700\u8FD1 maxCacheLength \u4E2A\u6570\u636E */\n        if (maxCacheLength !== Infinity && data.length >= maxCacheLength) {\n            data = newState[interfaceKey].slice(data.length - maxCacheLength + 1)\n        }\n        newState[interfaceKey] = [].concat(data, {\n            id,\n            requestTime,\n            request,\n            isFetching,\n        })\n    } else {\n        newState[interfaceKey] = data.map((item: IStateInterfaceItem) => (item.id === id ? { ...item, reponseTime, response, isFetching } : item))\n    }\n\n    return newState\n}\n\nexport const rapReducers = {\n    [RAP_STATE_KEY]: (state = {}) => state,\n}\n\n/** store enhancer */\nexport function rapEnhancer(config?: IEnhancerProps): StoreEnhancer<any> {\n    config = config || {}\n    const { requestPrefix, transformRequest = data => data, transformResponse = data => data, maxCacheLength = 2, fetch } = config\n\n    const request = typeof fetch === 'function' ? fetch : sendRequest\n\n    return (next: StoreCreator) => <S, A extends AnyAction>(reducers: Reducer<any, any>, ...args: any[]) => {\n        const store = next(reducers, ...args)\n\n        /** \u91CD\u65B0\u5B9A\u4E49 reducers */\n        const newReducers = (state: any, action: IAction): IStore => {\n            if (state) {\n                state[RAP_STATE_KEY] || (state[RAP_STATE_KEY] = {})\n            } else {\n                state = { [RAP_STATE_KEY]: {} }\n            }\n\n            if (!action.hasOwnProperty('type')) {\n                return reducers(state, action)\n            }\n\n            switch (action.type) {\n                /** \u8BF7\u6C42\u6210\u529F\uFF0C\u66F4\u65B0 store */\n                case RAP_REDUX_UPDATE_STORE:\n                    return {\n                        ...state,\n                        [RAP_STATE_KEY]: assignData({\n                            oldState: state[RAP_STATE_KEY],\n                            maxCacheLength,\n                            payload: action.payload,\n                        }),\n                    }\n                /** \u7528\u6237\u624B\u52A8\u6E05\u7A7A */\n                case RAP_REDUX_CLEAR_STORE:\n                    return {\n                        ...state,\n                        [RAP_STATE_KEY]: {\n                            ...state[RAP_STATE_KEY],\n                            ...action.payload,\n                        },\n                    }\n                default:\n                    return reducers(state, action)\n            }\n        }\n        store.replaceReducer(newReducers)\n\n        /** \u91CD\u65B0\u5B9A\u4E49 dispatch */\n        dispatch = async (action: IAction): Promise<any> => {\n            if (action.type !== RAP_REDUX_REQUEST) {\n                return store.dispatch(action)\n            }\n\n            const {\n                modelName,\n                endpoint,\n                method,\n                params,\n                cb,\n                types: [REQUEST, SUCCESS, FAILURE],\n            } = action.payload\n            const requestTime = new Date().getTime()\n\n            store.dispatch({ type: REQUEST })\n            store.dispatch({\n                type: RAP_REDUX_UPDATE_STORE,\n                payload: {\n                    interfaceKey: modelName,\n                    id: requestTime,\n                    requestTime,\n                    request: params,\n                    isFetching: true,\n                },\n            })\n            try {\n                /** \u8BF7\u6C42\u53C2\u6570\u7EDF\u4E00\u5904\u7406 */\n                let newParams = params\n                if (typeof transformRequest === 'function') {\n                    newParams = transformRequest(action.payload)\n                }\n\n                const responseData = await request({\n                    endpoint: getEndpoint(requestPrefix, endpoint),\n                    method,\n                    params: newParams,\n                })\n                const reponseTime = new Date().getTime()\n\n                cb && cb(responseData)\n                /** \u8BF7\u6C42\u6210\u529F\uFF0C\u66F4\u65B0store */\n                store.dispatch({\n                    type: RAP_REDUX_UPDATE_STORE,\n                    payload: {\n                        interfaceKey: modelName,\n                        id: requestTime,\n                        requestTime,\n                        reponseTime,\n                        request: params,\n                        response: transformResponse(responseData),\n                        isFetching: false,\n                    },\n                })\n                store.dispatch({ type: SUCCESS, payload: responseData })\n                return responseData\n            } catch (e) {\n                store.dispatch({ type: FAILURE, payload: e })\n                store.dispatch({\n                    type: RAP_REDUX_UPDATE_STORE,\n                    payload: {\n                        interfaceKey: modelName,\n                        id: requestTime,\n                        requestTime,\n                        isFetching: false,\n                    },\n                })\n                throw Error(e)\n            }\n        }\n\n        return { ...store, dispatch }\n    }\n}\n\n/** \u53D1\u9001\u8BF7\u6C42 */\nexport function dispatchAction(action: IAction): Promise<any> {\n    return dispatch(action)\n}\n";
