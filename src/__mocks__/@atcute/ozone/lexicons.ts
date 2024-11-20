// Mock implementation
export const label = {
  queryLabels: {
    auth: 'none',
    defs: {
      main: {
        type: 'query',
        parameters: {
          type: 'params',
          required: ['uris'],
          properties: {
            uris: {
              type: 'array',
              items: { type: 'string' }
            }
          }
        },
        output: {
          encoding: 'application/json',
          schema: {
            type: 'object',
            required: ['labels'],
            properties: {
              labels: {
                type: 'array',
                items: {
                  type: 'ref',
                  ref: 'lex:com.atproto.label.defs#label'
                }
              }
            }
          }
        }
      }
    }
  }
};
