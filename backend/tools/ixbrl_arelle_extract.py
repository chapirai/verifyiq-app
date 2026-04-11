#!/usr/bin/env python3
"""
Extract facts, contexts, and units from an Inline XBRL / XBRL instance using Arelle.
Prints a single JSON object to stdout (no logging to stdout).

Install: pip install -r requirements-arelle.txt

Usage: python ixbrl_arelle_extract.py /path/to/file.xhtml
"""
from __future__ import annotations

import json
import sys
import traceback
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path


def _json_safe(obj):
    if obj is None:
        return None
    if isinstance(obj, (str, int, float, bool)):
        return obj
    if isinstance(obj, Decimal):
        return float(obj)
    if isinstance(obj, (date, datetime)):
        return obj.isoformat()
    if isinstance(obj, bytes):
        return obj.decode("utf-8", errors="replace")
    return str(obj)


def _period_dict(ctx) -> dict:
    out = {"instant": None, "start": None, "end": None}
    try:
        if ctx is None:
            return out
        p = getattr(ctx, "period", None)
        if p is None:
            return out
        if getattr(p, "isInstantPeriod", False) or getattr(p, "instantEndTime", None):
            inst = getattr(p, "instantEndTime", None) or getattr(p, "instant", None)
            if inst is not None:
                out["instant"] = _json_safe(inst)
        else:
            if getattr(p, "startTime", None):
                out["start"] = _json_safe(p.startTime)
            if getattr(p, "endTime", None):
                out["end"] = _json_safe(p.endTime)
    except Exception:
        pass
    return out


def _dims_dict(ctx) -> dict:
    try:
        qd = getattr(ctx, "qnameDims", None) if ctx else None
        if not qd:
            return {}
        return {str(dim): str(mem) for dim, mem in qd.items()}
    except Exception:
        return {}


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "missing_file_argument"}))
        return 2

    path = Path(sys.argv[1])
    if not path.is_file():
        print(json.dumps({"ok": False, "error": "file_not_found", "path": str(path)}))
        return 3

    try:
        from arelle import Cntlr, FileSource  # type: ignore
    except ImportError:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "arelle_not_installed",
                    "hint": "pip install -r requirements-arelle.txt",
                }
            )
        )
        return 4

    result = {
        "ok": True,
        "source_path": str(path.resolve()),
        "arelle_version": None,
        "contexts": [],
        "units": [],
        "facts": [],
        "labels": [],
    }

    cntlr = None
    try:
        cntlr = Cntlr.Cntlr()
        cntlr.startLogging(logFileName="logToBuffer", logLevel="ERROR")
        file_source = FileSource.openFileSource(str(path.resolve()), cntlr)
        model_manager = cntlr.modelManager
        model_xbrl = model_manager.load(file_source, "ixbrl_extract")
        if model_xbrl is None:
            print(json.dumps({"ok": False, "error": "arelle_model_null"}))
            return 5

        try:
            import arelle.Version  # type: ignore

            result["arelle_version"] = getattr(arelle.Version, "version", None)
        except Exception:
            pass

        # Contexts
        for cid, ctx in sorted(model_xbrl.contexts.items(), key=lambda x: x[0]):
            pd = _period_dict(ctx)
            result["contexts"].append(
                {
                    "xbrl_context_id": str(cid),
                    "period_instant": pd.get("instant"),
                    "period_start": pd.get("start"),
                    "period_end": pd.get("end"),
                    "dimensions": _dims_dict(ctx),
                    "raw_json": {},
                }
            )

        # Units
        for uid, unit in sorted(model_xbrl.units.items(), key=lambda x: x[0]):
            measures = []
            try:
                for m in getattr(unit, "measures", None) or []:
                    measures.append(str(m))
            except Exception:
                pass
            result["units"].append(
                {
                    "xbrl_unit_id": str(uid),
                    "measures": measures,
                    "raw_json": {},
                }
            )

        facts_list = list(
            getattr(model_xbrl, "factsInInstance", None)
            or getattr(model_xbrl, "facts", None)
            or []
        )
        for i, fact in enumerate(facts_list):
            qn = getattr(fact, "qname", None)
            concept_qname = str(qn) if qn is not None else ""
            ctx = fact.context
            ctx_id = getattr(fact, "contextID", None) or (ctx.id if ctx and hasattr(ctx, "id") else None)
            unit_id = getattr(fact, "unitID", None) or getattr(fact, "unitId", None)
            is_nil = bool(getattr(fact, "isNil", False))
            vnum = None
            vtext = None
            if not is_nil:
                xv = getattr(fact, "xValue", None)
                if xv is not None:
                    if isinstance(xv, (int, float, Decimal)):
                        vnum = float(xv)
                    else:
                        vtext = _json_safe(xv)
                else:
                    vraw = getattr(fact, "value", None)
                    vtext = _json_safe(vraw) if vraw is not None else None

            dec = getattr(fact, "decimals", None)
            prec = getattr(fact, "precision", None)

            fact_row = {
                "sequence_index": i,
                "context_ref": str(ctx_id) if ctx_id is not None else None,
                "unit_ref": str(unit_id) if unit_id is not None else None,
                "concept_qname": concept_qname,
                "value_text": vtext,
                "value_numeric": vnum,
                "decimals": int(dec) if dec is not None and str(dec).lstrip("-").isdigit() else None,
                "precision_value": int(prec) if prec is not None and str(prec).lstrip("-").isdigit() else None,
                "is_nil": is_nil,
                "footnotes": [],
                "raw_json": {},
            }

            # Dimensions on fact (axis members)
            try:
                fdims = getattr(fact, "qnameDims", None)
                if fdims:
                    fact_row["dimensions"] = {str(d): str(m) for d, m in fdims.items()}
            except Exception:
                pass

            result["facts"].append(fact_row)

        # Labels (best-effort: iterate concepts in DTS)
        try:
            name_concepts = getattr(model_xbrl, "nameConcepts", None) or {}
            for concept in name_concepts.values():
                qn = getattr(concept, "qname", None)
                if qn is None:
                    continue
                lbl_fn = getattr(concept, "label", None)
                if callable(lbl_fn):
                    for lang in ("sv", "en"):
                        try:
                            lt = lbl_fn(preferredLabel=None, lang=lang)
                            if lt:
                                result["labels"].append(
                                    {
                                        "concept_qname": str(qn),
                                        "lang": lang,
                                        "label_role": "http://www.xbrl.org/2003/role/label",
                                        "label_text": str(lt),
                                    }
                                )
                                break
                        except Exception:
                            continue
        except Exception:
            pass

        print(json.dumps(result, ensure_ascii=False))
        return 0
    except Exception as e:
        print(
            json.dumps(
                {
                    "ok": False,
                    "error": "arelle_exception",
                    "message": str(e),
                    "traceback": traceback.format_exc(),
                }
            )
        )
        return 6
    finally:
        try:
            if cntlr is not None:
                cntlr.modelManager.close()
        except Exception:
            pass


if __name__ == "__main__":
    sys.exit(main())
