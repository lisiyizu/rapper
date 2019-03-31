import { createApi, createModel } from './api';
import { resolve } from 'path';
import { parse as parseUrl } from 'url';

createApi({
  projectId: 2025,
  folder: resolve(__dirname, '../test_data/api'),
  requestFactory: (itf, ReqType, ResType) => {
    return `
    import BaseManager = require('mxext/mmanager');
    import BaseModel = require('app/models/basemodel');
    const Manager = BaseManager.create(BaseModel);
    Manager.registerModels([{
      name: 'request',
      url: '${itf.url}',
      type: '${itf.method}'
    }])
    function request(req: ${ReqType}, alertError: boolean = true): Promise<${ResType}['data']> {
      return new Promise<${ResType}['data']>((resolve, reject) => {
        Manager.fetchOne({
          name: 'request',
          ${itf.method === 'GET' ? 'urlParams' : 'postParams'}: req,
        },(err, model) => {
          if(err) {
            alertError && alert(err.msg);
            return reject(err);
          }
          resolve(model.get('data'));
        })
      });
    }
    export default request;
    `;
  },
  urlMapper: url => url.replace('https://brandsearch.taobao.com', 'brandsearch')
})
  .then(() => {
    console.log('api success');
  })
  .catch(err => {
    console.log('api', err);
  });

createModel({
  projectId: 2025,
  modelPath: resolve(__dirname, '../test_data/model/model.ts'),
  requesterPath: resolve(__dirname, '../test_data/model/fetch.ts'),
  baseFetchPath: resolve(__dirname, './basefetch.ts'),
  urlMapper: url =>
    parseUrl(url)
      .pathname.replace(/^\//, '')
      .replace(/.json$/, '')
})
  .then(() => {
    console.log('model success');
  })
  .catch(err => {
    console.log('model', err);
  });


