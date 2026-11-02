-- The region now prints exactly as typed, so a bare number like "3" or "III" becomes "Region III".
UPDATE school_profile SET region = 'Region ' || CASE trim(region)
    WHEN '1' THEN 'I' WHEN '2' THEN 'II' WHEN '3' THEN 'III' WHEN '4' THEN 'IV' WHEN '5' THEN 'V'
    WHEN '6' THEN 'VI' WHEN '7' THEN 'VII' WHEN '8' THEN 'VIII' WHEN '9' THEN 'IX' WHEN '10' THEN 'X'
    WHEN '11' THEN 'XI' WHEN '12' THEN 'XII' WHEN '13' THEN 'XIII'
    ELSE upper(trim(region)) END
  WHERE upper(trim(region)) IN ('1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13',
    'I', 'II', 'III', 'IV', 'IV-A', 'IV-B', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII', 'XIII');
