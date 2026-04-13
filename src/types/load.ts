import { Database } from './database';

export type Load = Database['public']['Tables']['loads']['Row'];
export type LoadEvent = Database['public']['Tables']['load_events']['Row'];
export type ClientSite = Database['public']['Tables']['client_sites']['Row'];
export type Dumpyard = Database['public']['Tables']['dumpyards']['Row'];

export type LoadStatus = 'scheduled' | 'assigned' | 'en_route' | 'on_site' | 'service_done' | 'dumpyard_required' | 'completed' | 'cancelled';

export interface LoadWithDetails extends Load {
  customer: Database['public']['Tables']['customers']['Row'];
  driver: Database['public']['Tables']['drivers']['Row'] | null;
  site?: ClientSite | null;
  dumpyard?: Dumpyard | null;
  tenant?: { fee_rate: number };
}
