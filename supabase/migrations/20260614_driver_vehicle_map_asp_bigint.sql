-- driver_vehicle_map asp_id must support long ASP identifiers such as 137000000000.
ALTER TABLE driver_vehicle_map
  ALTER COLUMN asp_id TYPE BIGINT USING asp_id::BIGINT;
