/**
 * Supabase backend: one read (trainings_api.state) and one RPC per action.
 * Every action is checked and logged by the database itself
 * (supabase/migrations/0001_trainings.sql); errors come back in Hebrew.
 */
export function supabaseBackend(sb) {
  const api = () => sb.schema('trainings_api')
  return {
    mode: 'supabase',
    async load() {
      const { data, error } = await api().rpc('state')
      if (error) throw new Error(error.message)
      return data
    },
    async call(fn, args) {
      const { data, error } = await api().rpc(fn, args)
      if (error) throw new Error(error.message)
      return data
    },
  }
}
