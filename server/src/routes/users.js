export async function userRoutes(app) {
  app.get('/users/me', { preHandler: app.authenticate }, async (request) => ({
    user: request.currentUser,
  }))
}
