const { Deta } = jest.createMockFromModule('deta-worker')

Deta.mockImplementation(
  jest.fn(() => ({
    Base: jest.fn(),
  }))
)

module.exports = Deta('')
