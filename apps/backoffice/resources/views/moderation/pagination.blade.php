<x-pager
    :summary="'Page '.$page.' · '.$total.' total'"
    :prev="$page > 1 ? route($routeName, ['state' => $state->value, 'page' => $page - 1]) : null"
    :next="$page < 1000 && $page * $limit < $total ? route($routeName, ['state' => $state->value, 'page' => $page + 1]) : null" />
