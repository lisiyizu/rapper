import { JSONSchema4 } from 'json-schema';
import { compile, DEFAULT_OPTIONS, Options } from 'json-schema-to-typescript';
import { Interface } from '../types';
import * as JSON5 from 'json5';
import * as _ from 'lodash';

function inferArraySchema(
  p: Interface.Property,
  childProperties: JSONSchema4,
  common: Record<string, any>,
) {
  const rule = (p.rule && p.rule.trim()) || '';
  if (Object.keys(childProperties).length !== 0) {
    // 如果有子孙那么肯定是 object
    return [
      p.name,
      {
        type: 'array',
        items: {
          type: 'object',
          properties: childProperties,
          required: Object.keys(childProperties),
          additionalProperties: false,
        },
        ...common,
      },
    ];
  } else if (['+1', '1'].includes(rule) && p.value) {
    // 当 rule 为 +1 时 mockjs 从属性值 array 中顺序选取 1 个元素，作为最终值。
    // 当 rule 为 1 时 mockjs 从属性值 array 中随机选取 1 个元素，作为最终值。
    // 这时候这个属性的类型并非 array，而是 array 子元素的类型
    // 子元素的类型可以从 value 中推断出来
    try {
      const arr: any[] | any = JSON5.parse(p.value);
      if (Array.isArray(arr)) {
        const type = _.chain(arr)
          .map(e => typeof e)
          .uniq()
          .value();
        return [
          p.name,
          {
            type,
            ...common,
          },
        ];
      } else {
        // 解析失败，返回 any
        return [
          p.name,
          {
            type: ['string', 'number', 'boolean', 'object'],
            ...common,
          },
        ];
      }
    } catch (error) {
      // 解析失败，返回 any
      return [
        p.name,
        {
          type: ['string', 'number', 'boolean', 'object'],
          ...common,
        },
      ];
    }
  } else if (rule === '' && p.value) {
    // 当有无子孙、有值、且无生成规则时，默认做 hack 满足 rap2 无法表示 array<primitive> 的问题，
    // primitive 的具体类型通过 value 推断

    try {
      const v: any[] | any = JSON5.parse(p.value);

      if (Array.isArray(v)) {
        // 如果是数组使用数组元素类型
        const type = _.chain(v)
          .map(e => typeof e)
          .uniq()
          .value();
        return [
          p.name,
          {
            type: 'array',
            items: {
              type,
            },
            ...common,
          },
        ];
      } else {
        // 如果不是数组直接使用 value 类型
        const type = typeof v;
        return [
          p.name,
          {
            type: 'array',
            items: {
              type,
            },
            ...common,
          },
        ];
      }
    } catch (error) {
      // 解析失败 返回 array<any>
      return [
        p.name,
        {
          type: 'array',
          ...common,
        },
      ];
    }
  } else {
    // 无生成规则也无值，生成 array<any>
    return [
      p.name,
      {
        type: 'array',
        ...common,
      },
    ];
  }
}

type Scope = 'request' | 'response';

const removeComment = (str: string) => str.replace(/\/\*|\*\//g, '');

function interfaceToJSONSchema(itf: Interface.Root, scope: Scope): JSONSchema4 {
  let properties = itf.properties.filter(p => p.scope === scope);

  properties = [
    ...properties,
    {
      name: 'dummyroot',
      parentId: -2,
      id: -1,
      scope,
      type: 'object',
    } as any,
  ];

  function findChildProperties(parentId: number) {
    return _.chain(properties)
      .filter(p => p.parentId === parentId)
      .map(p => {
        const type = p.type.toLowerCase().replace(/regexp|function/, 'string');
        const childProperties = findChildProperties(p.id);
        const childItfs = properties.filter(x => x.parentId === p.id);
        const common: {
          description?: string;
          required: string[];
          additionalProperties: boolean;
        } = {
          // 这里默认所有的属性都有值
          additionalProperties: false,
          // request 的时候按照实际标注，response 全部默认存在
          required:
            scope === 'request'
              ? childItfs.filter(e => e.required).map(e => e.name)
              : childItfs.map(e => e.name),
        };
        if (p.description) common.description = removeComment(p.description);
        if (['string', 'number', 'integer', 'boolean', 'null'].includes(type)) {
          return [
            p.name,
            {
              type,
              ...common,
            },
          ];
        } else if (type === 'object') {
          return [
            p.name,
            {
              type,
              properties: childProperties,
              ...common,
            },
          ];
        } else if (type === 'array') {
          return inferArraySchema(p, childProperties, common);
        } else {
          throw `type: ${type}
          parentID: ${parentId}
          itf.url: ${itf.url}
          ${JSON.stringify(childProperties)}`;
        }
      })
      .fromPairs()
      .value();
  }

  const propertyChildren = findChildProperties(-2);

  return propertyChildren['dummyroot'];
}

export default function convert(itf: Interface.Root): Promise<Array<string>> {
  const reqJSONSchema = interfaceToJSONSchema(itf, 'request');
  const resJSONSchema = interfaceToJSONSchema(itf, 'response');

  const options: Options = {
    ...DEFAULT_OPTIONS,
    bannerComment: '',
  };
  return Promise.all([
    compile(reqJSONSchema, 'Req', options),
    compile(resJSONSchema, 'Res', options),
  ]);
}