export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      tenants: {
        Row: {
          id: string
          name: string
          slug: string
          logo_url: string | null
          default_currency: string
          timezone: string
          fee_rate: number
          created_by: string | null
          created_at: string
          updated_at: string
        }
      }
      profiles: {
        Row: {
          id: string
          tenant_id: string | null
          role: 'admin' | 'dispatcher' | 'driver' | null
          status: 'active' | 'inactive'
          email: string | null
          full_name: string | null
          avatar_url: string | null
          last_active_at: string
          created_at: string
          updated_at: string
        }
      }
      customers: {
        Row: {
          id: string
          tenant_id: string
          name: string
          contact_name: string | null
          email: string | null
          phone: string | null
          address_line1: string | null
          address_line2: string | null
          city: string | null
          country: string | null
          lat: number | null
          lng: number | null
          status: 'active' | 'inactive'
          created_at: string
          updated_at: string
        }
      }
      drivers: {
        Row: {
          id: string
          tenant_id: string
          user_id: string | null
          full_name: string
          phone: string | null
          license_number: string | null
          employee_id: string | null
          iqama_number: string | null
          iqama_expiry: string | null
          route_permit_expiry: string | null
          driver_card_expiry: string | null
          driver_license_expiry: string | null
          driver_picture_url: string | null
          status: 'available' | 'busy' | 'off_duty'
          monthly_target_loads: number
          created_at: string
          updated_at: string
        }
      }
      client_sites: {
        Row: {
          id: string
          tenant_id: string
          customer_id: string
          site_name: string
          address: string
          google_maps_link: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
      }
      dumpyards: {
        Row: {
          id: string
          tenant_id: string
          name: string
          region_or_city: string | null
          google_maps_link: string | null
          active: boolean
          notes: string | null
          created_at: string
          updated_at: string
        }
      }
      dumpsters: {
        Row: {
          id: string
          tenant_id: string
          asset_number: string
          size: string
          condition: string
          status: string
          notes: string | null
          created_at: string
          updated_at: string
        }
      }
      loads: {
        Row: {
          id: string
          tenant_id: string
          customer_id: string
          driver_id: string | null
          vehicle_id: string | null
          dumpster_id: string | null
          site_id: string | null
          dumpyard_id: string | null
          parent_load_id: string | null
          google_maps_link: string | null
          load_type: 'New Deployment' | 'Pickup' | 'Exchange'
          status: 'scheduled' | 'assigned' | 'en_route' | 'on_site' | 'service_done' | 'dumpyard_required' | 'completed' | 'cancelled'
          weight_kg: number | null
          load_value: number | null
          currency: string
          dispatched_at: string | null
          started_at: string | null
          completed_at: string | null
          cancelled_at: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
      }
      load_events: {
        Row: {
          id: string
          tenant_id: string
          load_id: string
          actor_id: string | null
          from_status: string | null
          to_status: string
          notes: string | null
          metadata: Json
          created_at: string
        }
      }
      platform_fees: {
        Row: {
          id: string
          tenant_id: string
          debtor_tenant_id: string
          load_id: string
          load_value: number
          fee_rate: number
          fee_amount: number
          currency: string
          status: string
          created_at: string
        }
      }
      team_invites: {
        Row: {
          id: string
          tenant_id: string
          email: string
          role: 'admin' | 'dispatcher' | 'driver'
          status: 'pending' | 'accepted'
          created_at: string
        }
      }
      notifications: {
        Row: {
          id: string
          tenant_id: string
          user_id: string
          title: string
          message: string
          type: string
          read_at: string | null
          created_at: string
        }
      }
      audit_logs: {
        Row: {
          id: string
          tenant_id: string
          actor_id: string | null
          action: string
          entity_type: string
          entity_id: string | null
          old_data: Json
          new_data: Json
          metadata: Json
          created_at: string
        }
      }
      driver_work_sessions: {
        Row: {
          id: string
          tenant_id: string
          driver_id: string
          clocked_in_at: string
          clocked_out_at: string | null
          break_started_at: string | null
          total_break_minutes: number
          notes: string | null
          created_at: string
          updated_at: string
        }
      }
      driver_work_session_events: {
        Row: {
          id: string
          tenant_id: string
          session_id: string
          driver_id: string
          event_type: 'clock_in' | 'clock_out' | 'break_start' | 'break_end' | 'admin_correction'
          notes: string | null
          actor_id: string | null
          created_at: string
        }
      }
      driver_live_status: {
        Row: {
          driver_id: string
          tenant_id: string
          session_id: string | null
          clocked_in: boolean
          on_break: boolean
          clocked_in_since: string | null
          break_since: string | null
          updated_at: string
        }
      }
      driver_load_sessions: {
        Row: {
          id: string
          tenant_id: string
          load_id: string
          driver_id: string
          session_id: string | null
          outcome: 'in_progress' | 'completed' | 'cancelled'
          started_at: string
          ended_at: string | null
          created_at: string
        }
      }
    }
  }
}
