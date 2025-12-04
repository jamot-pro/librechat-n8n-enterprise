class GraphApiService {
  constructor() {
    this.enabled = false;
    console.log('[GraphApiService] Disabled - OpenID client not compatible');
  }

  async getAccessToken() {
    throw new Error('GraphApiService is disabled');
  }

  async searchPeople() {
    return [];
  }

  async getGroupMembers() {
    return [];
  }
}

module.exports = GraphApiService;
