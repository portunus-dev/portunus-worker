jest.mock('../modules/db')
const deta = require('../modules/db')
const { getAuditHistory } = require('../modules/audit')

beforeEach(() => {
  deta.insertMock.mockClear()
  deta.getMock.mockClear()
  deta.putMock.mockClear()
  deta.updateMock.mockClear()
  deta.fetchMock.mockClear()
  deta.deleteMock.mockClear()
})

describe('Audit Module', () => {
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
