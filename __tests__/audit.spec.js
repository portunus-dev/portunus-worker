jest.mock('../modules/db')
const deta = require('../modules/db')
const {
  withLogging,
  convertRequestToHumanReadableString,
  getAuditHistory,
} = require('../modules/audit')

beforeEach(() => {
  deta.insertMock.mockClear()
  deta.getMock.mockClear()
  deta.putMock.mockClear()
  deta.updateMock.mockClear()
  deta.fetchMock.mockClear()
  deta.deleteMock.mockClear()
})

describe('Audit Module', () => {
  test('withLogging should return if req._log already exists', () => {
    const req = { _log: true }
    withLogging(req)
    expect(req._log).toEqual(true)
  })
  test('withLogging should construct _log object', () => {
    const req = { cf: { a: 1 }, headers: [['b', 2]] }
    withLogging(req)
    // only enforce cf & header inclusion for now
    expect(req._log.cf.a).toEqual(1)
    expect(req._log.headers.b).toEqual(2)
  })
  test('convertToHumanReadableString should return Unknown Operation', () => {
    const humanReadableString = convertRequestToHumanReadableString({
      method: 'NOT FOUND',
    })
    expect(humanReadableString).toEqual('Unknown operation')
  })
  test('convertToHumanReadableString should format string for known operation', () => {
    const humanReadableString = convertRequestToHumanReadableString({
      apiPath: 'env',
      method: 'PUT',
      url: 'https://www.test.com/test?a=1&b=2',
      params: { updates: { add: {}, edit: {}, remove: [] }, c: 3 },
    })
    expect(humanReadableString).toEqual(
      'env - Update for stage - ?a=1&b=2 - add[], edit[], remove[], c: 3'
    )
  })
  test('getAuditHistory should return current auditHistory for user', async () => {
    const auditHistory = await getAuditHistory({
      type: 'user',
      key: 'test-key',
    })
    expect(deta.getMock).toBeCalledTimes(1)
    expect(auditHistory.length).toEqual(2)
  })
  test('getAuditHistory should return current auditHistory for team', async () => {
    const auditHistory = await getAuditHistory({
      type: 'team',
      key: 'test-key',
    })
    expect(deta.getMock).toBeCalledTimes(1)
    expect(auditHistory.length).toEqual(2)
  })
  test('getAuditHistory should return empty auditHistory', async () => {
    const auditHistory = await getAuditHistory({
      type: 'user',
      key: 'does-not-exist',
    })
    expect(deta.getMock).toBeCalledTimes(1)
    expect(auditHistory).toEqual([])
  })
})
