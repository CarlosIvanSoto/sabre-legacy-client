import { request } from "../../common/helpers/request.helper";
import { ActionsRQ } from "../../common/interfaces/actions.interface";
import { queueAccess } from "../helpers/queue-access.helper";
import { queueIdentifier } from "../helpers/queue-identifier.helper";
import { AccessOptions } from "./interfaces/access-options.interface";

/**
 * {{header}}
 * 
 * {{queueAccess(queueInfo)}}
 * 
 * {{footer}}
 * @param options AccessOptions
 * @returns string
 */
function accessListRequest(options: AccessOptions) {
  const { pcc, number, authorization, conversationId } = options;
  const queueInfo = queueIdentifier({ pcc, number, ind: true });
  const body = queueAccess(queueInfo);
  return request({
    body, authorization, conversationId, action: ActionsRQ.QUEUE_ACCESS
  })
}

export { accessListRequest }