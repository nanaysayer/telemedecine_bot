//CHECKSUM:5b64b0f6ed544c25d4a73563c8173b5fbda88a70eace3a361764008fe73dcc1e
/**
 * Sends feedback (1 for positive or -1 for negative) at the end of a goal
 *
 * @title Send Feedback
 * @category NDU
 * @author Botpress, Inc.
 * @param {number} [value] - The feedback value. Use 1 for positive feedback, -1 for negative feedback
 */

const sendFeedback = async value => {
  const feedback = parseInt(value.trim())
  if (feedback !== 1 && feedback !== -1) {
    throw `Unexpected value: ${value}`
  }
  const previousWorkflow = event.state.session.lastWorkflows[0]
  if (!previousWorkflow) {
    return
  }

  await bp.events.saveUserFeedback(previousWorkflow.eventId, event.target, feedback, 'workflow')
}

return sendFeedback(args.value)
