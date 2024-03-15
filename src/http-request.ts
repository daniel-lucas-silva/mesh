import { HttpRequest as UHttpRequest, HttpResponse as UHttpResponse, getParts } from 'uWebSockets.js';
import { parseQuery } from './utils';

export interface UploadedFile {
  data: ArrayBuffer;
  filename: string;
  type: string;
}

export class HttpRequest {
  /**
   * Request user defined data
   */
  data: { [key: string]: any } = {};

  private bodyData: Buffer | null = null;
  private contentType = '';
  private paramKeys: string[];
  private req: UHttpRequest;
  private res: UHttpResponse;

  constructor(req: UHttpRequest, res: UHttpResponse, paramKeys: string[]) {
    this.req = req;
    this.res = res;
    this.paramKeys = paramKeys;
  }

  /**
   * Request body content
   */
  async body(): Promise<{ [key: string]: any }> {
    this.contentType = this.contentType ? this.contentType : this.req.getHeader('content-type');

    if (!this.contentType) return {};

    const body = this.bodyData ? this.bodyData : await this.getBody(this.res);

    if (!body) return {};

    this.bodyData = body;

    if (this.contentType === 'application/json' || this.contentType === 'application/x-www-form-urlencoded') {
      const bodyStr = body.toString();
      
      if (!bodyStr) return {};

      return this.contentType === 'application/json' ? JSON.parse(body.toString()) : parseQuery(body.toString());
    } else if (this.contentType.startsWith('multipart/form-data')) {
      const data: any = {};

      getParts(body, this.contentType)?.forEach(p => {
        if (!p.type && !p.filename) data[p.name] = Buffer.from(p.data).toString();
      });

      return data;
    } else return body;
  }

  /**
   * Request body content
   */
  async files(): Promise<{ [key: string]: UploadedFile | undefined }> {
    this.contentType = this.contentType ? this.contentType : this.req.getHeader('content-type');

    if (!this.contentType) return {}

    const body = this.bodyData ? this.bodyData : await this.getBody(this.res);

    if (!body) return {};

    this.bodyData = body;

    if (this.contentType.startsWith('multipart/form-data')) {
      const data: any = {};

      getParts(body, this.contentType)?.forEach(p => {
        if (p.type && p.filename) data[p.name] = { data: p.data, filename: p.filename, type: p.type };
      });

      return data;
    } else return {};
  }

  /**
   * Request headers
   */
  headers(): { [key: string]: string } {
    const headers: any = {};

    this.req.forEach((key, value) => headers[key] = value);

    return headers;
  }

  /**
   * Lowercased HTTP method
   */
  method() {
    return this.req.getMethod();
  }

  /**
   * Request path params
   */
  params(): { [key: string]: string } {
    const data: any = {};

    for (let i = 0; i < this.paramKeys.length; i++) data[this.paramKeys[i].slice(1)] = this.req.getParameter(i);

    return data;
  }

  /**
   * Request query params
   */
  query(): { [key: string]: any } {
    const query = this.req.getQuery();

    if (query) return parseQuery(query);

    return {};
  }

  /**
   * Request URL including initial /slash
   */
  url() {
    return this.req.getUrl();
  }

  private async getBody(res: UHttpResponse): Promise<Buffer> {
    let buffer: Buffer;

    return new Promise(resolve => res.onData((ab, isLast) => {
      const chunk = Buffer.from(ab);

      if (isLast) {
        if (buffer) resolve(Buffer.concat([buffer, chunk]));
        else resolve(chunk);
      } else {
        if (buffer) buffer = Buffer.concat([buffer, chunk]);
        else buffer = Buffer.concat([chunk]);
      }
    }));
  }
}
