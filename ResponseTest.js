class ResponseTest {
  body
  headers
  status

  constructor(body, { headers, status }) {
    this.body = body
    this.headers = headers
    this.status = status
  }

  getBody() {
    return JSON.parse(this.body)
  }
}

module.exports = ResponseTest
