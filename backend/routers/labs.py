import os
from fastapi import APIRouter

router = APIRouter(tags=["labs"])


@router.get('/labs/capabilities')
def get_lab_capabilities():
    provider = os.getenv('KUBECRASH_REAL_CLUSTER_PROVIDER', 'disabled')
    enabled = os.getenv('KUBECRASH_REAL_CLUSTER_ENABLED', 'false').lower() == 'true'

    if enabled:
        return {
            'simulation': {'enabled': True, 'label': 'Simulation'},
            'realCluster': {
                'enabled': True,
                'label': 'Real Cluster (Beta)',
                'provider': provider,
                'reason': 'Real cluster mode is enabled. Use with local resource limits in mind.',
            },
        }

    return {
        'simulation': {'enabled': True, 'label': 'Simulation'},
        'realCluster': {
            'enabled': False,
            'label': 'Real Cluster (Beta)',
            'provider': provider,
            'reason': 'Real cluster mode is not enabled yet. Set KUBECRASH_REAL_CLUSTER_ENABLED=true to activate.',
        },
    }
