import { FormatQueueOptions, FormatQueueResponse } from "./interfaces"
import { parseParagraphToWarnings } from "./parse-paragraph-to-warnings"
import { parseWarningsToNotifications } from "./parse-warnings-to-notifications"

function formatQueueResponse(payload: FormatQueueOptions): FormatQueueResponse {
  const { paragraph, queue, bookingId, } = payload
  
  const warnings = parseParagraphToWarnings(paragraph)
  const notifications = parseWarningsToNotifications({ queue, warnings })
  return { 
    bookingId,
    notifications
  }
}
export { formatQueueResponse }