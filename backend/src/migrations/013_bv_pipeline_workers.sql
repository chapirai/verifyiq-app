BEGIN;

CREATE OR REPLACE FUNCTION bv_parsed.load_hvd_organisation_from_raw(p_raw_payload_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_raw public.bv_raw_payloads%rowtype;
  v_org jsonb;
  v_idx integer;
  v_snapshot_id bigint;
BEGIN
  SELECT *
  INTO v_raw
  FROM public.bv_raw_payloads
  WHERE id = p_raw_payload_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Raw payload % not found', p_raw_payload_id;
  END IF;

  IF v_raw.content->'highValueDataset'->'organisationer' IS NULL THEN
    RETURN;
  END IF;

  FOR v_org, v_idx IN
    SELECT value, ordinality::int
    FROM jsonb_array_elements(v_raw.content->'highValueDataset'->'organisationer') WITH ORDINALITY
  LOOP
    INSERT INTO bv_parsed.hvd_organisation_snapshots (
      raw_payload_id, tenant_id, organisationsnummer, snapshot_id, provider_source, payload_created_at, source_index,
      juridisk_form_kod, juridisk_form_klartext, organisationsform_kod, organisationsform_klartext,
      registreringsland_kod, registreringsland_klartext, organisationsdatum_registreringsdatum,
      verksam_organisation_kod, verksamhetsbeskrivning, postadress_utdelningsadress, postadress_postnummer,
      postadress_postort, postadress_land, raw_item
    )
    VALUES (
      v_raw.id,
      v_raw.tenant_id,
      COALESCE(v_org->'organisationsidentitet'->>'identitetsbeteckning', v_raw.organisationsnummer),
      v_raw.snapshot_id,
      v_raw.provider_source,
      v_raw.created_at,
      v_idx,
      v_org->'juridiskForm'->>'kod',
      v_org->'juridiskForm'->>'klartext',
      v_org->'organisationsform'->>'kod',
      v_org->'organisationsform'->>'klartext',
      v_org->'registreringsland'->>'kod',
      v_org->'registreringsland'->>'klartext',
      bv_parsed.try_date(v_org->'organisationsdatum'->>'registreringsdatum'),
      v_org->'verksamOrganisation'->>'kod',
      v_org->'verksamhetsbeskrivning'->>'beskrivning',
      v_org->'postadressOrganisation'->'postadress'->>'utdelningsadress',
      v_org->'postadressOrganisation'->'postadress'->>'postnummer',
      v_org->'postadressOrganisation'->'postadress'->>'postort',
      v_org->'postadressOrganisation'->'postadress'->>'land',
      v_org
    )
    ON CONFLICT (raw_payload_id, source_index) DO NOTHING
    RETURNING id INTO v_snapshot_id;

    IF v_snapshot_id IS NULL THEN
      SELECT id INTO v_snapshot_id
      FROM bv_parsed.hvd_organisation_snapshots
      WHERE raw_payload_id = v_raw.id AND source_index = v_idx;
    END IF;

    INSERT INTO bv_parsed.hvd_organisation_names (
      hvd_organisation_snapshot_id, source_index, namn, registreringsdatum,
      organisationsnamntyp_kod, organisationsnamntyp_klartext,
      verksamhetsbeskrivning_sarskilt_foretagsnamn, raw_item
    )
    SELECT
      v_snapshot_id,
      ordinality::int,
      x->>'namn',
      bv_parsed.try_date(x->>'registreringsdatum'),
      x->'organisationsnamntyp'->>'kod',
      x->'organisationsnamntyp'->>'klartext',
      x->>'verksamhetsbeskrivningSarskiltForetagsnamn',
      x
    FROM jsonb_array_elements(COALESCE(v_org->'organisationsnamn'->'organisationsnamnLista','[]'::jsonb)) WITH ORDINALITY AS t(x, ordinality)
    ON CONFLICT DO NOTHING;

    INSERT INTO bv_parsed.hvd_organisation_sni (
      hvd_organisation_snapshot_id, source_index, sni_kod, sni_klartext, raw_item
    )
    SELECT
      v_snapshot_id,
      ordinality::int,
      x->>'kod',
      x->>'klartext',
      x
    FROM jsonb_array_elements(COALESCE(v_org->'naringsgrenOrganisation'->'sni','[]'::jsonb)) WITH ORDINALITY AS t(x, ordinality)
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION bv_parsed.load_fi_organisation_from_raw(p_raw_payload_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_raw public.bv_raw_payloads%rowtype;
  v_org jsonb;
  v_org_idx integer;
  v_snapshot_id bigint;
  v_fun jsonb;
  v_fun_idx integer;
  v_fun_id bigint;
BEGIN
  SELECT *
  INTO v_raw
  FROM public.bv_raw_payloads
  WHERE id = p_raw_payload_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Raw payload % not found', p_raw_payload_id;
  END IF;

  IF v_raw.content->'organisationInformation' IS NULL THEN
    RETURN;
  END IF;

  FOR v_org, v_org_idx IN
    SELECT value, ordinality::int
    FROM jsonb_array_elements(v_raw.content->'organisationInformation') WITH ORDINALITY
  LOOP
    INSERT INTO bv_parsed.fi_organisation_snapshots (
      raw_payload_id, tenant_id, organisationsnummer, snapshot_id, provider_source, payload_created_at, source_index,
      arendenummer, arende_avslutat_tidpunkt, identitet_typ_kod, identitet_typ_klartext,
      organisationsnamn, organisationsnamn_typ_kod, organisationsnamn_typ_klartext,
      organisationsform_kod, organisationsform_klartext,
      organisationsdatum_registreringsdatum, organisationsdatum_bildat_datum,
      hemvist_typ, hemvist_lan_kod, hemvist_lan_klartext, hemvist_kommun_kod, hemvist_kommun_klartext,
      rakenskapsar_inleds, rakenskapsar_avslutas, verksamhetsbeskrivning,
      organisationsadress_postadress, organisationsadress_postnummer, organisationsadress_postort, organisationsadress_epost,
      firmateckning_klartext, antal_valda_ledamoter, antal_valda_suppleanter,
      aktiekapital_belopp, aktiekapital_valuta, antal_aktier, kvotvarde_belopp, kvotvarde_valuta,
      aktiekapital_grans_lagst, aktiekapital_grans_hogst, antal_aktier_grans_lagst, antal_aktier_grans_hogst,
      aktiegranser_valuta, raw_item
    )
    VALUES (
      v_raw.id,
      v_raw.tenant_id,
      COALESCE(v_org->'identitet'->>'identitetsbeteckning', v_raw.organisationsnummer),
      v_raw.snapshot_id,
      v_raw.provider_source,
      v_raw.created_at,
      v_org_idx,
      v_org->'arende'->>'arendenummer',
      bv_parsed.try_timestamptz(v_org->'arende'->>'avslutatTidpunkt'),
      v_org->'identitet'->'typ'->>'kod',
      v_org->'identitet'->'typ'->>'klartext',
      v_org->'organisationsnamn'->>'namn',
      v_org->'organisationsnamn'->'typ'->>'kod',
      v_org->'organisationsnamn'->'typ'->>'klartext',
      v_org->'organisationsform'->>'kod',
      v_org->'organisationsform'->>'klartext',
      bv_parsed.try_date(v_org->'organisationsdatum'->>'registreringsdatum'),
      bv_parsed.try_date(v_org->'organisationsdatum'->>'bildatDatum'),
      v_org->'hemvistkommun'->>'typ',
      v_org->'hemvistkommun'->'lanForHemvistkommun'->>'kod',
      v_org->'hemvistkommun'->'lanForHemvistkommun'->>'klartext',
      v_org->'hemvistkommun'->'kommun'->>'kod',
      v_org->'hemvistkommun'->'kommun'->>'klartext',
      v_org->'rakenskapsar'->>'rakenskapsarInleds',
      v_org->'rakenskapsar'->>'rakenskapsarAvslutas',
      v_org->>'verksamhetsbeskrivning',
      v_org->'organisationsadresser'->'postadress'->>'adress',
      v_org->'organisationsadresser'->'postadress'->>'postnummer',
      v_org->'organisationsadresser'->'postadress'->>'postort',
      v_org->'organisationsadresser'->>'epostadress',
      v_org->'firmateckning'->>'klartext',
      NULLIF(v_org->'antalValdaFunktionarer'->>'ledamoter','')::integer,
      NULLIF(v_org->'antalValdaFunktionarer'->>'suppleanter','')::integer,
      bv_parsed.try_numeric(v_org->'aktieinformation'->'aktiekapital'->>'belopp'),
      v_org->'aktieinformation'->'aktiekapital'->>'valuta',
      bv_parsed.try_numeric(v_org->'aktieinformation'->>'antalAktier'),
      bv_parsed.try_numeric(v_org->'aktieinformation'->'kvotvarde'->>'belopp'),
      v_org->'aktieinformation'->'kvotvarde'->>'valuta',
      bv_parsed.try_numeric(v_org->'aktieinformation'->'aktiegranser'->'aktiekapitalGranser'->>'lagst'),
      bv_parsed.try_numeric(v_org->'aktieinformation'->'aktiegranser'->'aktiekapitalGranser'->>'hogst'),
      bv_parsed.try_numeric(v_org->'aktieinformation'->'aktiegranser'->'antalAktierGranser'->>'lagst'),
      bv_parsed.try_numeric(v_org->'aktieinformation'->'aktiegranser'->'antalAktierGranser'->>'hogst'),
      v_org->'aktieinformation'->'aktiegranser'->>'valuta',
      v_org
    )
    ON CONFLICT (raw_payload_id, source_index) DO NOTHING
    RETURNING id INTO v_snapshot_id;

    IF v_snapshot_id IS NULL THEN
      SELECT id INTO v_snapshot_id
      FROM bv_parsed.fi_organisation_snapshots
      WHERE raw_payload_id = v_raw.id AND source_index = v_org_idx;
    END IF;

    INSERT INTO bv_parsed.fi_organisation_names (
      fi_organisation_snapshot_id, source_index, namn, typ_kod, typ_klartext, registreringsdatum, raw_item
    )
    SELECT
      v_snapshot_id,
      ordinality::int,
      x->>'namn',
      x->'typ'->>'kod',
      x->'typ'->>'klartext',
      bv_parsed.try_date(x->>'registreringsdatum'),
      x
    FROM jsonb_array_elements(COALESCE(v_org->'samtligaOrganisationsnamn','[]'::jsonb)) WITH ORDINALITY AS t(x, ordinality)
    ON CONFLICT DO NOTHING;

    FOR v_fun, v_fun_idx IN
      SELECT value, ordinality::int
      FROM jsonb_array_elements(COALESCE(v_org->'funktionarer','[]'::jsonb)) WITH ORDINALITY
    LOOP
      INSERT INTO bv_parsed.fi_funktionarer (
        fi_organisation_snapshot_id, source_index, fornamn, efternamn, identitetsbeteckning,
        identitet_typ_kod, identitet_typ_klartext, postadress_adress, postadress_postnummer, postadress_postort, raw_item
      )
      VALUES (
        v_snapshot_id,
        v_fun_idx,
        v_fun->'personnamn'->>'fornamn',
        v_fun->'personnamn'->>'efternamn',
        v_fun->'identitet'->>'identitetsbeteckning',
        v_fun->'identitet'->'typ'->>'kod',
        v_fun->'identitet'->'typ'->>'klartext',
        v_fun->'postadress'->>'adress',
        v_fun->'postadress'->>'postnummer',
        v_fun->'postadress'->>'postort',
        v_fun
      )
      ON CONFLICT (fi_organisation_snapshot_id, source_index) DO UPDATE
      SET fornamn = EXCLUDED.fornamn,
          efternamn = EXCLUDED.efternamn,
          identitetsbeteckning = EXCLUDED.identitetsbeteckning,
          identitet_typ_kod = EXCLUDED.identitet_typ_kod,
          identitet_typ_klartext = EXCLUDED.identitet_typ_klartext,
          postadress_adress = EXCLUDED.postadress_adress,
          postadress_postnummer = EXCLUDED.postadress_postnummer,
          postadress_postort = EXCLUDED.postadress_postort,
          raw_item = EXCLUDED.raw_item
      RETURNING id INTO v_fun_id;

      INSERT INTO bv_parsed.fi_funktionar_roller (
        fi_funktionar_id, source_index, roll_kod, roll_klartext, raw_item
      )
      SELECT
        v_fun_id,
        ordinality::int,
        x->>'kod',
        x->>'klartext',
        x
      FROM jsonb_array_elements(COALESCE(v_fun->'funktionarsroller','[]'::jsonb)) WITH ORDINALITY AS t(x, ordinality)
      ON CONFLICT DO NOTHING;
    END LOOP;

    INSERT INTO bv_parsed.fi_finansiella_rapport_arenden (
      fi_organisation_snapshot_id, source_index, arendenummer, avslutat_tidpunkt, raw_item
    )
    SELECT
      v_snapshot_id,
      ordinality::int,
      x->'arende'->>'arendenummer',
      bv_parsed.try_timestamptz(x->'arende'->>'avslutatTidpunkt'),
      x
    FROM jsonb_array_elements(COALESCE(v_org->'finansiellaRapporter','[]'::jsonb)) WITH ORDINALITY AS t(x, ordinality)
    ON CONFLICT DO NOTHING;

    INSERT INTO bv_parsed.fi_finansiella_rapporter (
      fi_finansiell_rapport_arende_id, source_index, rapporttyp_kod, rapporttyp_klartext, ankom_datum,
      handlaggning_avslutad_datum, registrerad_datum, innehaller_koncernredovisning, period_from, period_tom,
      vinstutdelning_beslutad_datum, vinstutdelning_valuta_kod, vinstutdelning_valuta_klartext,
      vinstutdelning_belopp, raw_item
    )
    SELECT
      a.id,
      rr.ordinality::int,
      rr.x->'rapportTyp'->>'kod',
      rr.x->'rapportTyp'->>'klartext',
      bv_parsed.try_date(rr.x->>'ankomDatum'),
      bv_parsed.try_date(rr.x->>'handlaggningAvslutadDatum'),
      bv_parsed.try_date(rr.x->>'registreradDatum'),
      CASE
        WHEN rr.x ? 'innehallerKoncernredovisning'
        THEN (rr.x->>'innehallerKoncernredovisning')::boolean
        ELSE NULL
      END,
      bv_parsed.try_date(rr.x->'rapporteringsperiod'->>'periodFrom'),
      bv_parsed.try_date(rr.x->'rapporteringsperiod'->>'periodTom'),
      bv_parsed.try_date(rr.x->'vinstutdelning'->>'beslutadDatum'),
      rr.x->'vinstutdelning'->'valuta'->>'kod',
      rr.x->'vinstutdelning'->'valuta'->>'klartext',
      bv_parsed.try_numeric(rr.x->'vinstutdelning'->>'belopp'),
      rr.x
    FROM bv_parsed.fi_finansiella_rapport_arenden a
    JOIN LATERAL jsonb_array_elements(COALESCE(a.raw_item->'rapporter','[]'::jsonb)) WITH ORDINALITY AS rr(x, ordinality) ON TRUE
    WHERE a.fi_organisation_snapshot_id = v_snapshot_id
    ON CONFLICT DO NOTHING;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION bv_parsed.load_hvd_dokumentlista_from_raw(p_raw_payload_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_raw public.bv_raw_payloads%rowtype;
  v_snapshot_id bigint;
BEGIN
  SELECT * INTO v_raw
  FROM public.bv_raw_payloads
  WHERE id = p_raw_payload_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Raw payload % not found', p_raw_payload_id;
  END IF;

  IF v_raw.content->'dokument' IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO bv_parsed.hvd_dokumentlista_snapshots (
    raw_payload_id, tenant_id, organisationsnummer, snapshot_id, provider_source, payload_created_at, raw_payload
  )
  VALUES (
    v_raw.id, v_raw.tenant_id, v_raw.organisationsnummer, v_raw.snapshot_id, v_raw.provider_source, v_raw.created_at, v_raw.content
  )
  ON CONFLICT (raw_payload_id) DO NOTHING
  RETURNING id INTO v_snapshot_id;

  IF v_snapshot_id IS NULL THEN
    SELECT id INTO v_snapshot_id
    FROM bv_parsed.hvd_dokumentlista_snapshots
    WHERE raw_payload_id = v_raw.id;
  END IF;

  INSERT INTO bv_parsed.hvd_dokument (
    hvd_dokumentlista_snapshot_id, source_index, dokument_id, filformat, registreringstidpunkt, rapporteringsperiod_tom, raw_item
  )
  SELECT
    v_snapshot_id,
    ordinality::int,
    x->>'dokumentId',
    x->>'filformat',
    bv_parsed.try_date(x->>'registreringstidpunkt'),
    bv_parsed.try_date(x->>'rapporteringsperiodTom'),
    x
  FROM jsonb_array_elements(v_raw.content->'dokument') WITH ORDINALITY AS t(x, ordinality)
  ON CONFLICT DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION bv_parsed.dispatch_raw_payload(p_raw_payload_id uuid)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_raw public.bv_raw_payloads%rowtype;
BEGIN
  SELECT * INTO v_raw
  FROM public.bv_raw_payloads
  WHERE id = p_raw_payload_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Raw payload % not found', p_raw_payload_id;
  END IF;

  BEGIN
    IF v_raw.provider_source IN ('FI_ORGANISATIONER', 'ORCHESTRATED_LOOKUP', 'BV_ORCHESTRATED') THEN
      PERFORM bv_parsed.load_fi_organisation_from_raw(p_raw_payload_id);
    END IF;

    IF v_raw.provider_source IN ('HVD_ORGANISATIONER', 'ORCHESTRATED_LOOKUP', 'BV_ORCHESTRATED') THEN
      PERFORM bv_parsed.load_hvd_organisation_from_raw(p_raw_payload_id);
    END IF;

    IF v_raw.provider_source IN ('HVD_DOKUMENTLISTA') OR (v_raw.content ? 'dokument') THEN
      PERFORM bv_parsed.load_hvd_dokumentlista_from_raw(p_raw_payload_id);
    END IF;

    INSERT INTO bv_parsed.parse_runs (
      raw_payload_id, tenant_id, organisationsnummer, provider_source, parsed_ok, parsed_at
    )
    VALUES (
      v_raw.id, v_raw.tenant_id, v_raw.organisationsnummer, v_raw.provider_source, TRUE, NOW()
    )
    ON CONFLICT (raw_payload_id) DO UPDATE
    SET parsed_ok = TRUE,
        parse_error = NULL,
        parsed_at = EXCLUDED.parsed_at;

  EXCEPTION WHEN OTHERS THEN
    INSERT INTO bv_parsed.parse_runs (
      raw_payload_id, tenant_id, organisationsnummer, provider_source, parsed_ok, parse_error, parsed_at
    )
    VALUES (
      v_raw.id, v_raw.tenant_id, v_raw.organisationsnummer, v_raw.provider_source, FALSE, SQLERRM, NOW()
    )
    ON CONFLICT (raw_payload_id) DO UPDATE
    SET parsed_ok = FALSE,
        parse_error = EXCLUDED.parse_error,
        parsed_at = EXCLUDED.parsed_at;

    RAISE;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION bv_pipeline.create_lookup_request(
  p_tenant_id uuid,
  p_organisationsnummer varchar,
  p_requested_by_user_id uuid DEFAULT NULL,
  p_requested_source varchar DEFAULT NULL
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v_lookup_request_id bigint;
BEGIN
  INSERT INTO bv_pipeline.lookup_requests (
    tenant_id, organisationsnummer, requested_by_user_id, requested_source, request_status, started_at
  )
  VALUES (
    p_tenant_id, p_organisationsnummer, p_requested_by_user_id, p_requested_source, 'queued', NOW()
  )
  RETURNING lookup_request_id INTO v_lookup_request_id;

  RETURN v_lookup_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION bv_pipeline.enqueue_raw_payload_for_parse(
  p_raw_payload_id uuid,
  p_lookup_request_id bigint DEFAULT NULL,
  p_priority integer DEFAULT 100
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_raw public.bv_raw_payloads%rowtype;
BEGIN
  SELECT * INTO v_raw
  FROM public.bv_raw_payloads
  WHERE id = p_raw_payload_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Raw payload % not found', p_raw_payload_id;
  END IF;

  INSERT INTO bv_pipeline.parse_queue (
    raw_payload_id, lookup_request_id, tenant_id, organisationsnummer, provider_source, status, priority, available_at
  )
  VALUES (
    v_raw.id, p_lookup_request_id, v_raw.tenant_id, v_raw.organisationsnummer, v_raw.provider_source, 'pending', p_priority, NOW()
  )
  ON CONFLICT (raw_payload_id) DO NOTHING;

  IF p_lookup_request_id IS NOT NULL THEN
    UPDATE bv_pipeline.lookup_requests
    SET latest_raw_payload_id = v_raw.id,
        parse_status = 'pending',
        request_status = 'parsing',
        updated_at = NOW()
    WHERE lookup_request_id = p_lookup_request_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION bv_pipeline.enqueue_company_refresh(
  p_tenant_id uuid,
  p_organisationsnummer varchar,
  p_lookup_request_id bigint DEFAULT NULL,
  p_priority integer DEFAULT 100
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO bv_pipeline.refresh_queue (
    lookup_request_id, tenant_id, organisationsnummer, status, priority, available_at
  )
  VALUES (
    p_lookup_request_id, p_tenant_id, p_organisationsnummer, 'pending', p_priority, NOW()
  )
  ON CONFLICT DO NOTHING;

  IF p_lookup_request_id IS NOT NULL THEN
    UPDATE bv_pipeline.lookup_requests
    SET refresh_status = 'pending',
        request_status = 'refreshing',
        updated_at = NOW()
    WHERE lookup_request_id = p_lookup_request_id;
  END IF;
END;
$$;

CREATE OR REPLACE PROCEDURE bv_pipeline.process_parse_queue(
  p_batch_size integer DEFAULT 100,
  p_worker_name text DEFAULT 'parse_worker'
)
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    WITH candidates AS (
      SELECT pq.parse_queue_id
      FROM bv_pipeline.parse_queue pq
      WHERE pq.status IN ('pending', 'retry')
        AND pq.available_at <= NOW()
      ORDER BY pq.priority ASC, pq.created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT p_batch_size
    )
    UPDATE bv_pipeline.parse_queue pq
    SET status = 'processing',
        locked_at = NOW(),
        locked_by = p_worker_name,
        updated_at = NOW()
    FROM candidates c
    WHERE pq.parse_queue_id = c.parse_queue_id
    RETURNING pq.*
  LOOP
    BEGIN
      PERFORM bv_parsed.dispatch_raw_payload(r.raw_payload_id);

      UPDATE bv_pipeline.parse_queue
      SET status = 'done',
          locked_at = NULL,
          locked_by = NULL,
          last_error = NULL,
          updated_at = NOW()
      WHERE parse_queue_id = r.parse_queue_id;

      IF r.lookup_request_id IS NOT NULL THEN
        UPDATE bv_pipeline.lookup_requests
        SET parse_status = 'done',
            request_status = 'refreshing',
            updated_at = NOW()
        WHERE lookup_request_id = r.lookup_request_id;
      END IF;

      PERFORM bv_pipeline.enqueue_company_refresh(
        r.tenant_id, r.organisationsnummer, r.lookup_request_id, r.priority
      );

    EXCEPTION WHEN OTHERS THEN
      UPDATE bv_pipeline.parse_queue
      SET attempt_count = attempt_count + 1,
          status = CASE
                     WHEN attempt_count + 1 >= max_attempts THEN 'failed'
                     ELSE 'retry'
                   END,
          available_at = CASE
                           WHEN attempt_count + 1 >= max_attempts THEN available_at
                           ELSE NOW() + INTERVAL '2 minutes'
                         END,
          locked_at = NULL,
          locked_by = NULL,
          last_error = SQLERRM,
          updated_at = NOW()
      WHERE parse_queue_id = r.parse_queue_id;

      IF r.lookup_request_id IS NOT NULL THEN
        UPDATE bv_pipeline.lookup_requests
        SET parse_status = 'failed',
            request_status = 'failed',
            request_error = SQLERRM,
            updated_at = NOW()
        WHERE lookup_request_id = r.lookup_request_id;
      END IF;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE PROCEDURE bv_pipeline.process_refresh_queue(
  p_batch_size integer DEFAULT 100,
  p_worker_name text DEFAULT 'refresh_worker'
)
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
BEGIN
  FOR r IN
    WITH candidates AS (
      SELECT rq.refresh_queue_id
      FROM bv_pipeline.refresh_queue rq
      WHERE rq.status IN ('pending', 'retry')
        AND rq.available_at <= NOW()
      ORDER BY rq.priority ASC, rq.created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT p_batch_size
    )
    UPDATE bv_pipeline.refresh_queue rq
    SET status = 'processing',
        locked_at = NOW(),
        locked_by = p_worker_name,
        updated_at = NOW()
    FROM candidates c
    WHERE rq.refresh_queue_id = c.refresh_queue_id
    RETURNING rq.*
  LOOP
    BEGIN
      PERFORM bv_read.refresh_company_current_all(r.tenant_id, r.organisationsnummer);

      UPDATE bv_pipeline.refresh_queue
      SET status = 'done',
          locked_at = NULL,
          locked_by = NULL,
          last_error = NULL,
          updated_at = NOW()
      WHERE refresh_queue_id = r.refresh_queue_id;

      IF r.lookup_request_id IS NOT NULL THEN
        UPDATE bv_pipeline.lookup_requests
        SET refresh_status = 'done',
            request_status = 'completed',
            completed_at = NOW(),
            updated_at = NOW()
        WHERE lookup_request_id = r.lookup_request_id;
      END IF;

    EXCEPTION WHEN OTHERS THEN
      UPDATE bv_pipeline.refresh_queue
      SET attempt_count = attempt_count + 1,
          status = CASE
                     WHEN attempt_count + 1 >= max_attempts THEN 'failed'
                     ELSE 'retry'
                   END,
          available_at = CASE
                           WHEN attempt_count + 1 >= max_attempts THEN available_at
                           ELSE NOW() + INTERVAL '2 minutes'
                         END,
          locked_at = NULL,
          locked_by = NULL,
          last_error = SQLERRM,
          updated_at = NOW()
      WHERE refresh_queue_id = r.refresh_queue_id;

      IF r.lookup_request_id IS NOT NULL THEN
        UPDATE bv_pipeline.lookup_requests
        SET refresh_status = 'failed',
            request_status = 'failed',
            request_error = SQLERRM,
            updated_at = NOW()
        WHERE lookup_request_id = r.lookup_request_id;
      END IF;
    END;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION bv_pipeline.enqueue_all_unparsed_raw_payloads(
  p_priority integer DEFAULT 100
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO bv_pipeline.parse_queue (
    raw_payload_id, tenant_id, organisationsnummer, provider_source, status, priority, available_at
  )
  SELECT
    r.id,
    r.tenant_id,
    r.organisationsnummer,
    r.provider_source,
    'pending',
    p_priority,
    NOW()
  FROM public.bv_raw_payloads r
  LEFT JOIN bv_parsed.parse_runs pr
    ON pr.raw_payload_id = r.id
  LEFT JOIN bv_pipeline.parse_queue pq
    ON pq.raw_payload_id = r.id
  WHERE pr.raw_payload_id IS NULL
    AND pq.raw_payload_id IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION bv_pipeline.enqueue_all_company_refreshes(
  p_priority integer DEFAULT 100
)
RETURNS integer
LANGUAGE plpgsql
AS $$
DECLARE
  v_count integer;
BEGIN
  INSERT INTO bv_pipeline.refresh_queue (
    tenant_id, organisationsnummer, status, priority, available_at
  )
  SELECT DISTINCT
    s.tenant_id,
    s.organisationsnummer,
    'pending',
    p_priority,
    NOW()
  FROM (
    SELECT tenant_id, organisationsnummer FROM bv_parsed.fi_organisation_snapshots
    UNION
    SELECT tenant_id, organisationsnummer FROM bv_parsed.hvd_organisation_snapshots
    UNION
    SELECT tenant_id, organisationsnummer FROM bv_parsed.hvd_dokumentlista_snapshots
  ) s
  ON CONFLICT DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMIT;
