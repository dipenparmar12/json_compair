// Test the parseFlexibleJSON function with the user's data
const { parseFlexibleJSON } = require('./json_utils.js');

// Test data from the user
const testData = `{'AC_installed_kbtuh': 20.627267924931886, 'ceiling_and_roof_r_assembly_ip': 12.66, 'central_ac_seer': 8.0, 'cooling_setpoint_f': 74.5, 'dhw_eff': 0.525, 'dhw_gal_per_day': 69.0, 'dhw_location': 'unfinishedattic', 'dhw_size_gal': 37.999992468205484, 'dhw_type': 'gas', 'duct_leakage_fraction': 0.15, 'duct_r_value_ip': 2.1, 'floor_area': 1110.0, 'floor_area_model': 1461.2032455789276, 'furnace_eff': 0.663, 'furnace_installed_kbtuh': 26.186002815507894, 'furnace_type': 'gas', 'heating_setpoint_f': 67.5, 'infiltration_ach': 0.29, 'lighting_ave_lm_per_watt': 59, 'plug_load_annual_energy': 2199.255, 'radiant_barrier': False, 'roof_surfaces': [{'Area': 38.010099384247326, 'Azimuth': 178.70000000000005, 'Tilt': 26.6}, {'Area': 38.010099384247326, 'Azimuth': 268.70000000000005, 'Tilt': 26.6}], 'solar_avg_azimuth': 88.7, 'solar_avg_tilt': 26.6, 'solar_kw': 0.0, 'total_lighting_lumens': 37740.0, 'utility_baseline_region': 'T', 'wall_r_assembly_ip': 9.09, 'whole_house_fan': False, 'window_shgc': 0.5, 'window_u_factor_ip': 0.65}`;

console.log('Testing parseFlexibleJSON with Python dict data...\n');

try {
  const result = parseFlexibleJSON(testData);
  console.log('✓ Parsing succeeded!');
  console.log('\nFormatted result:');
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error('✗ Parsing failed:');
  console.error(err.message);
}
