
import type { Actions, FetchRequestOptions, SabreOptions } from "./interfaces";
import { getSubString } from "./common/utils/get-sub-string";
import { baseUrl, conversationId, domain, userAgent } from "./config";
import type { PostOptions } from "./common/interfaces/post-options.interface";
import type { HeadersRequestOptions } from "./common/interfaces/headers-request-options.interface";
import { Authentication } from "./authentication/authentication.";
import { Queue } from "./queue/queue";
import { DailySales } from "./daily-sales/daily-sales";
import type { SessionCreateOptions } from "./authentication/requests/interfaces/session-create-options.interface";
import { ActionsRQ } from "./common/interfaces/actions.interface";
import { ErrorInResponse, FaultError } from "./common/utils";
import { Currency } from "./currency/currency";

export class Sabre {
  private readonly headers: Headers;
  private readonly headersRequest: HeadersRequestOptions
  private readonly options: SabreOptions = {}
  private lastReq: FetchRequestOptions | {} = {};

  readonly authentication = new Authentication(this)
  readonly queue = new Queue(this)
  readonly dailySales = new DailySales(this)
  readonly currency = new Currency(this)

  constructor(options: SabreOptions | undefined = {}) {
    const { username, password, organization } = options
    const processEnv = typeof process !== 'undefined' && process.env
    if (!username && processEnv) 
      this.options.username = processEnv.SABRE_USERNAME
    if (!password && processEnv)
      this.options.password = processEnv.SABRE_PASSWORD
    if (!organization && processEnv)
      this.options.organization = processEnv.SABRE_ORGANIZATION

    if (!this.options.username || !this.options.password || !this.options.organization) {
      throw new Error('Missing LegacySabre authorization. Pass it to the constructor `new LegacySabre("USERNAME", "PASSWORD", "ORGANIZATION")')
    }

    this.headers = new Headers({
      'User-Agent': userAgent,
      'Content-Type': 'text/xml; charset="utf-8"',
      'Content-Encoding': 'deflate'
    });
    this.headersRequest = {
      conversationId, authorization: ''
    }
  }

  setAction(action: Actions) {
    this.headers.set('SOAPAction', action)
  }
  setAuthorization(token: string) {
    this.headersRequest.authorization = token;
    this.headers.set('Authorization', `Bearer ${token}`)
  }
  getAuthorization() {
    return this.headersRequest.authorization
  }

  getLastRequest() {
    return this.lastReq;
  }

  async fetchRequest(
    options: FetchRequestOptions | {} = {},
  ): Promise<string> {
    this.lastReq = options
    try {
      const response = await fetch(baseUrl, options);
      const xml = await response.text()
  
      if (!response.ok) {
        const fault = getSubString(xml, '<faultstring>', '</faultstring>', false)
        throw new FaultError(fault)
      }
      const body = getSubString(xml, '<soap-env:Body>', '</soap-env:Body>', false)
      const error = getSubString(body, '<stl:Error>', '</stl:Error>', false) 
      if (error) {
        const message = getSubString(error, '<stl:Message>', '</stl:Message>', false)
        throw new ErrorInResponse(message)
      }
      const action = this.headers.get('SOAPAction')
      // AUTHORIZATION INTERNAL MANAGEMENT
      // Change authorization internal for the reason: token no exported - vie 14 de mar del 25
      if (action === ActionsRQ.SESSION_CREATE || action === ActionsRQ.TOKEN_CREATE) {
        const token = getSubString(xml, '<wsse:BinarySecurityToken valueType="String" EncodingType="wsse:Base64Binary">', '</wsse:BinarySecurityToken>', false);
        this.setAuthorization(token)
      } else if (action === ActionsRQ.SESSION_CLOSE) {
        this.headersRequest.authorization = '';
        this.headers.delete('Authorization')
      }
  
      return body;
    } catch (error) {
      if (error instanceof FaultError || error instanceof ErrorInResponse) {
        throw error;
      }
      throw error instanceof Error 
        ? error 
        : new Error('Unknown error');
    }
  }

  async post(handlerRequest: (payload: HeadersRequestOptions) => string, options: PostOptions = {}): Promise<string> {
    if (!this.headersRequest.authorization) throw new Error('Missing authorization. Set it in setAuthorization("TOKEN")')
    const requestOptions = {
      method: 'POST',
      headers: this.headers,
      body: handlerRequest(this.headersRequest),
      ...options,
    };

    return this.fetchRequest(requestOptions);
  }

  async auth(handlerRequest:(payload: SessionCreateOptions) => string, options: PostOptions = {}): Promise<string> {
    if (!this.options.username || !this.options.password || !this.options.organization)
      throw new Error('Missing authorization. Pass it to the constructor `new LegacySabre("USERNAME", "PASSWORD", "ORGANIZATION")')

    const requestOptions = {
      method: 'POST',
      headers: this.headers,
      body: handlerRequest({
        conversationId: conversationId,
        authorization: {
          username: this.options.username,
          password: this.options.password,
          pcc: this.options.organization,
          domain: domain
        }
      }),
      ...options,
    };

    return this.fetchRequest(requestOptions);
  }
}